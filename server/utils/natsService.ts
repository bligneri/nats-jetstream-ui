import {
  connect,
  type NatsConnection,
  type JetStreamManager,
  type JetStreamClient,
  StringCodec,
} from "nats";
import {
  NatsConnectionDetails,
  StreamInfo,
  ConsumerInfo,
  NatsMessage,
  StorageType,
  RetentionPolicy,
  AckPolicy,
} from "~/types";

export class NatsService {
  private nc: NatsConnection | null = null;
  private jsm: JetStreamManager | null = null;
  private js: JetStreamClient | null = null;
  private connectionDetails: NatsConnectionDetails | null = null;
  private isConnecting: boolean = false;

  // Memory optimization settings
  private readonly MAX_SEARCH_RANGE = 10000; // Reduced from 50000
  private readonly CHUNK_SIZE = 500; // Process messages in chunks

  async connect(details: NatsConnectionDetails): Promise<void> {
    try {
      this.isConnecting = true;
      console.log("🔌 Connecting to NATS:", details.serverUrl);

      // Close existing connection if any
      if (this.nc) {
        console.log("🔌 Closing existing connection...");
        await this.nc.close();
        this.nc = null;
        this.jsm = null;
        this.js = null;
      }

      // Store connection details BEFORE connecting so we can reconnect later
      this.connectionDetails = details;

      // Connect to NATS
      this.nc = await connect({
        servers: details.serverUrl,
        user: details.user,
        pass: details.password,
      });

      console.log("🔌 Getting JetStream manager...");
      // Initialize JetStream manager and client
      this.jsm = await this.nc.jetstreamManager();
      this.js = this.nc.jetstream();
      this.isConnecting = false;

      console.log("✅ Connected to NATS JetStream successfully");
      console.log(`✅ Connection state: nc=${!!this.nc}, jsm=${!!this.jsm}, js=${!!this.js}`);
    } catch (error) {
      console.error("❌ Failed to connect to NATS:", error);
      this.nc = null;
      this.jsm = null;
      this.js = null;
      this.connectionDetails = null;
      this.isConnecting = false;
      throw new Error(
        `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async ensureConnected(): Promise<void> {
    // If already connected, nothing to do
    if (this.isConnected()) {
      return;
    }

    // If we have connection details but no connection, try to reconnect
    if (this.connectionDetails && !this.isConnecting) {
      console.log("🔄 Auto-reconnecting to NATS...");
      await this.connect(this.connectionDetails);
      return;
    }

    // No connection and no details stored
    throw new Error("Not connected to NATS. Call connect() first.");
  }

  isConnected(): boolean {
    return this.nc !== null && this.jsm !== null && this.js !== null && !this.isConnecting;
  }

  hasConnectionDetails(): boolean {
    return this.connectionDetails !== null;
  }

  getConnectionInfo(): NatsConnectionDetails | null {
    return this.connectionDetails;
  }

  /**
   * Fetch messages in chunks to avoid memory spikes
   * Processes messages in batches and stops early when limit is reached
   */
  private async fetchMessagesInChunks(
    streamName: string,
    startSeq: number,
    endSeq: number,
    limit: number,
    subjectFilter?: string
  ): Promise<NatsMessage[]> {
    const messages: NatsMessage[] = [];
    const totalRange = endSeq - startSeq + 1;
    const numChunks = Math.ceil(totalRange / this.CHUNK_SIZE);

    console.log(`🔄 Fetching ${totalRange} messages in ${numChunks} chunks of ${this.CHUNK_SIZE}`);

    // Process backwards from most recent
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const chunkStart = Math.max(startSeq, endSeq - (chunkIndex + 1) * this.CHUNK_SIZE + 1);
      const chunkEnd = endSeq - chunkIndex * this.CHUNK_SIZE;

      console.log(`  📦 Chunk ${chunkIndex + 1}/${numChunks}: seq ${chunkStart} to ${chunkEnd}`);

      // Fetch this chunk in parallel
      const fetchPromises = [];
      for (let seq = chunkEnd; seq >= chunkStart; seq--) {
        fetchPromises.push(
          this.jsm.streams.getMessage(streamName, { seq }).catch(() => null)
        );
      }

      const results = await Promise.all(fetchPromises);

      // Process results and filter
      for (const msg of results) {
        if (!msg) continue;

        // Apply subject filter if provided
        if (subjectFilter && msg.subject !== subjectFilter) {
          continue;
        }

        const headers: { [key: string]: string[] } = {};
        if (msg.headers) {
          for (const [key, values] of msg.headers) {
            headers[key] = Array.isArray(values) ? values : [values];
          }
        }

        messages.push({
          seq: msg.seq,
          subject: msg.subject,
          data: Buffer.from(msg.data).toString("base64"),
          headers: Object.keys(headers).length > 0 ? headers : undefined,
          time: msg.time,
        });

        // Early exit if we have enough messages
        if (messages.length >= limit) {
          console.log(`  ✅ Reached limit of ${limit} messages, stopping early`);
          return messages;
        }
      }

      console.log(`  ✓ Chunk ${chunkIndex + 1} complete, ${messages.length}/${limit} messages found`);
    }

    return messages;
  }

  /**
   * Fetch messages with wildcard pattern matching in chunks
   */
  private async fetchMessagesWithPatternInChunks(
    streamName: string,
    startSeq: number,
    endSeq: number,
    limit: number,
    pattern: string
  ): Promise<NatsMessage[]> {
    const messages: NatsMessage[] = [];
    const totalRange = endSeq - startSeq + 1;
    const numChunks = Math.ceil(totalRange / this.CHUNK_SIZE);

    console.log(`🔄 Fetching ${totalRange} messages in ${numChunks} chunks with pattern matching`);

    // Process backwards from most recent
    for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
      const chunkStart = Math.max(startSeq, endSeq - (chunkIndex + 1) * this.CHUNK_SIZE + 1);
      const chunkEnd = endSeq - chunkIndex * this.CHUNK_SIZE;

      console.log(`  📦 Chunk ${chunkIndex + 1}/${numChunks}: seq ${chunkStart} to ${chunkEnd}`);

      // Fetch this chunk in parallel
      const fetchPromises = [];
      for (let seq = chunkStart; seq <= chunkEnd; seq++) {
        fetchPromises.push(
          this.jsm.streams.getMessage(streamName, { seq }).catch(() => null)
        );
      }

      const results = await Promise.all(fetchPromises);

      // Process results and filter by pattern
      for (const msg of results) {
        if (!msg) continue;

        if (this.natsSubjectMatches(msg.subject, pattern)) {
          const headers: { [key: string]: string[] } = {};
          if (msg.headers) {
            for (const [key, values] of msg.headers) {
              headers[key] = Array.isArray(values) ? values : [values];
            }
          }

          messages.push({
            seq: msg.seq,
            subject: msg.subject,
            data: Buffer.from(msg.data).toString("base64"),
            headers: Object.keys(headers).length > 0 ? headers : undefined,
            time: msg.time,
          });

          // Early exit if we have enough messages
          if (messages.length >= limit) {
            console.log(`  ✅ Reached limit of ${limit} messages, stopping early`);
            return messages;
          }
        }
      }

      console.log(`  ✓ Chunk ${chunkIndex + 1} complete, ${messages.length}/${limit} messages found`);
    }

    return messages;
  }

  /**
   * Detect subject patterns from a source stream by getting subjects directly from stream info
   * Returns a map of subject -> message count
   */
  private async detectSubjectPatterns(streamName: string, sampleSize: number = 200): Promise<Map<string, number>> {
    const startTime = Date.now();
    try {
      console.log(`🔍 [${streamName}] Starting fast pattern detection using stream subjects...`);

      // Get stream info which includes subject details
      const streamInfo = await this.jsm.streams.info(streamName, { subjects_filter: '>' });

      const subjectMap = new Map<string, number>();

      // Check if stream has subject details
      if (streamInfo.state.subjects) {
        console.log(`🔍 [${streamName}] Found ${Object.keys(streamInfo.state.subjects).length} unique subjects in stream state`);

        // Use the full exact subject with message counts
        for (const [subject, count] of Object.entries(streamInfo.state.subjects)) {
          subjectMap.set(subject, count);
        }
      } else {
        console.log(`⚠️ [${streamName}] No subject details in stream state, falling back to message sampling...`);

        // Fallback: sample messages (no accurate counts available)
        const consumer = await this.js.consumers.get(streamName, {
          deliver_policy: 'last_per_subject',
          filter_subject: '>',
        });

        const iter = await consumer.fetch({ max_messages: sampleSize, expires: 5000 });
        let count = 0;

        for await (const msg of iter) {
          if (msg.subject) {
            // Use full subject as pattern (count unknown, set to 1)
            subjectMap.set(msg.subject, subjectMap.get(msg.subject) || 1);
            count++;
          }
        }
        console.log(`🔍 [${streamName}] Sampled ${count} messages`);
      }

      const totalTime = Date.now() - startTime;
      console.log(`✅ [${streamName}] Detected ${subjectMap.size} unique subjects in ${totalTime}ms`);
      const subjects = Array.from(subjectMap.keys()).slice(0, 10);
      console.log(`✅ [${streamName}] Subjects:`, subjects, subjectMap.size > 10 ? `... and ${subjectMap.size - 10} more` : '');
      return subjectMap;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [${streamName}] Failed to detect subject patterns after ${totalTime}ms:`, error);
      return new Map();
    }
  }

  async getStreams(): Promise<StreamInfo[]> {
    console.log(`📊 getStreams called - Connection state: nc=${!!this.nc}, jsm=${!!this.jsm}, js=${!!this.js}, isConnecting=${this.isConnecting}`);

    await this.ensureConnected();

    try {
      const streams: StreamInfo[] = [];
      const streamsList = await this.jsm.streams.list().next();

      for await (const streamInfo of streamsList) {
        // Map NATS stream info to our types
        const retention = this.mapRetentionPolicy(streamInfo.config.retention);
        const storage = this.mapStorageType(streamInfo.config.storage);

        const baseStream: StreamInfo = {
          config: {
            name: streamInfo.config.name,
            subjects: streamInfo.config.subjects || [],
            retention,
            max_consumers: streamInfo.config.max_consumers ?? -1,
            max_msgs: streamInfo.config.max_msgs ?? -1,
            max_bytes: streamInfo.config.max_bytes ?? -1,
            max_age: streamInfo.config.max_age ?? 0,
            storage,
            num_replicas: streamInfo.config.num_replicas ?? 1,
          },
          state: {
            messages: streamInfo.state.messages,
            bytes: streamInfo.state.bytes,
            first_seq: streamInfo.state.first_seq,
            last_seq: streamInfo.state.last_seq,
            consumer_count: streamInfo.state.consumer_count,
            first_ts: streamInfo.state.first_ts,
            last_ts: streamInfo.state.last_ts,
          },
          created: streamInfo.created,
        };

        // Check if this is a source stream (no subjects configured)
        if (baseStream.config.subjects.length === 0 && baseStream.state.messages > 0) {
          console.log(`📦 Source stream detected: ${baseStream.config.name}, expanding into virtual streams...`);

          // Always add the parent stream first (so users can view aggregate metadata)
          streams.push(baseStream);

          // Detect subject patterns with counts
          const subjectMap = await this.detectSubjectPatterns(baseStream.config.name, 500);

          if (subjectMap.size > 0) {
            // Create virtual streams for each subject
            // Filter out subjects with 0 messages (likely from down/unreachable external sources)
            for (const [subject, messageCount] of subjectMap.entries()) {
              if (messageCount > 0) {
                streams.push({
                  ...baseStream,
                  config: {
                    ...baseStream.config,
                    name: `${baseStream.config.name}/${subject}`,
                    subjects: [subject], // Exact subject
                  },
                  state: {
                    ...baseStream.state,
                    messages: messageCount, // Accurate count from stream info
                    bytes: -1, // Unknown - will display as "Unknown" in UI
                  },
                  isVirtual: true,
                  parentStream: baseStream.config.name,
                  virtualSubject: subject,
                });
              } else {
                console.log(`⏭️  Skipping virtual stream for "${subject}" (0 messages - source may be down)`);
              }
            }
          }
        } else {
          // Regular stream with subjects configured
          streams.push(baseStream);
        }
      }

      console.log(`📊 Found ${streams.length} streams (including virtual streams)`);
      return streams;
    } catch (error) {
      console.error("Failed to get streams:", error);
      throw new Error(
        `Failed to fetch streams: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getConsumers(streamName: string): Promise<ConsumerInfo[]> {
    await this.ensureConnected();

    try {
      // Handle virtual stream names (e.g., "AggregatedDataCombined/AggregatedDataEvents.hub")
      const actualStreamName = streamName.includes('/') ? streamName.split('/')[0] : streamName;

      const consumers: ConsumerInfo[] = [];
      const consumersList = await this.jsm.consumers.list(actualStreamName).next();

      for await (const consumerInfo of consumersList) {
        const ackPolicy = this.mapAckPolicy(consumerInfo.config.ack_policy);

        consumers.push({
          stream_name: streamName,
          name: consumerInfo.name,
          config: {
            durable_name: consumerInfo.config.durable_name,
            ack_policy: ackPolicy,
            ack_wait: consumerInfo.config.ack_wait ?? 0,
            max_deliver: consumerInfo.config.max_deliver ?? -1,
            filter_subject: consumerInfo.config.filter_subject || "",
            replay_policy: consumerInfo.config.replay_policy || "instant",
          },
          created: consumerInfo.created,
          num_ack_pending: consumerInfo.num_ack_pending ?? 0,
          num_redelivered: consumerInfo.num_redelivered ?? 0,
          num_waiting: consumerInfo.num_waiting ?? 0,
        });
      }

      console.log(`👥 Found ${consumers.length} consumers for stream ${streamName}`);
      return consumers;
    } catch (error) {
      console.error(`Failed to get consumers for ${streamName}:`, error);
      throw new Error(
        `Failed to fetch consumers: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async getMessages(subject: string, limit: number = 50, offset: number = 0, streamName?: string): Promise<NatsMessage[]> {
    console.log(`📨 getMessages called for subject="${subject}", streamName="${streamName || 'auto'}" - Connection state: nc=${!!this.nc}, jsm=${!!this.jsm}, js=${!!this.js}, isConnecting=${this.isConnecting}`);

    await this.ensureConnected();

    try {
      let messages: NatsMessage[] = [];
      let targetStream: string | null = null;

      // If streamName is provided (from virtual stream), use it directly
      if (streamName) {
        // Handle virtual stream names (e.g., "AggregatedDataCombined/AggregatedDataEvents.hub")
        targetStream = streamName.includes('/') ? streamName.split('/')[0] : streamName;
        console.log(`📊 Using provided stream: ${targetStream} (virtual: ${streamName.includes('/')})`);
      } else {
        // Find stream that contains this subject
        const streamsList = await this.jsm.streams.list().next();

        for await (const streamInfo of streamsList) {
          const subjects = streamInfo.config.subjects || [];
          // Check if subject pattern could match stream subjects
          // For example, if looking for "CleanData.*.0x123", check if stream has "CleanData.>"
          if (subjects.some((s) => this.couldMatchStream(subject, s))) {
            targetStream = streamInfo.config.name;
            console.log(`📊 Found stream ${targetStream} with subjects: ${subjects.join(', ')}`);
            break;
          }
        }
      }

      if (!targetStream) {
        console.log(`⚠️  No stream found for subject pattern: ${subject}`);
        return [];
      }

      // For EXACT subjects, use last_by_subj (fast when it works)
      // For WILDCARDS, use parallel fetch
      const isExactSubject = !subject.includes("*") && !subject.includes(">");

      if (isExactSubject) {
        console.log(`⚡ Exact subject - using last_by_subj for instant lookup`);

        try {
          // Use last_by_subj to instantly find the most recent message
          console.log(`🔍 Using last_by_subj API for subject: "${subject}"`);
          const lastMsg = await this.jsm.streams.getMessage(targetStream, {
            last_by_subj: subject
          });

          console.log(`✅ Found most recent at seq ${lastMsg.seq} with subject "${lastMsg.subject}"`);

          // Calculate search range accounting for offset
          // Each "page" searches MAX_SEARCH_RANGE messages
          const searchWindowEnd = lastMsg.seq - 1 - offset;
          const searchWindowStart = Math.max(1, searchWindowEnd - this.MAX_SEARCH_RANGE + 1);

          console.log(`🔍 Searching with offset ${offset}: seq ${searchWindowStart} to ${searchWindowEnd} in chunks`);

          // Use chunked fetching to avoid memory spike
          const foundMessages = await this.fetchMessagesInChunks(
            targetStream,
            searchWindowStart,
            searchWindowEnd,
            limit,
            subject // Filter by exact subject
          );

          messages.push(...foundMessages);

          console.log(`📊 Found ${messages.length} matches in ${this.MAX_SEARCH_RANGE} range`);


          // Sort newest first
          messages.sort((a, b) => b.seq - a.seq);

          // Don't slice - we already have the right amount
          // Just limit to the requested amount
          messages = messages.slice(0, limit);

          console.log(`📨 Returning ${messages.length} messages for exact subject (searched 10k range)`);
          return messages;

        } catch (err: any) {
          console.error(`❌ last_by_subj failed for "${subject}":`, err.message);
          console.log(`🔄 Returning empty - subject might not exist or timeout`);
          return [];
        }
      }

      // For WILDCARD patterns, fetch recent messages and filter
      const streamInfo = await this.jsm.streams.info(targetStream);
      const lastSeq = streamInfo.state.last_seq;
      const firstSeq = streamInfo.state.first_seq;

      if (lastSeq === 0 || firstSeq === 0) {
        console.log(`⚠️  Stream is empty`);
        return [];
      }

      console.log(`📊 Stream ${targetStream}: seq ${firstSeq} to ${lastSeq}`);

      // Use chunked fetching with a reasonable search range
      // For wildcard patterns, search up to MAX_SEARCH_RANGE messages
      const fetchCount = Math.min(limit * 10, this.MAX_SEARCH_RANGE);
      const endSeq = lastSeq - offset;
      const startSeq = Math.max(firstSeq, endSeq - fetchCount + 1);

      console.log(`⚡ Wildcard pattern - chunked fetch: ${fetchCount} messages (seq ${startSeq} to ${endSeq})`);

      // Use chunked fetching with pattern matching
      messages = await this.fetchMessagesWithPatternInChunks(
        targetStream,
        startSeq,
        endSeq,
        limit,
        subject
      );

      // Sort by sequence number, newest first
      messages.sort((a, b) => b.seq - a.seq);

      console.log(`📨 Returning ${messages.length} messages for wildcard pattern`);
      return messages;
    } catch (error) {
      console.error(`Failed to get messages for ${subject}:`, error);
      return [];
    }
  }

  // Legacy method - fallback for when consumer method fails
  private async getMessagesLegacy(subject: string, limit: number = 50, offset: number = 0): Promise<NatsMessage[]> {
    console.log(`⚠️  Using legacy message fetch method for ${subject}`);

    const messages: NatsMessage[] = [];

    // Find stream that contains this subject
    const streamsList = await this.jsm!.streams.list().next();
    let targetStream: string | null = null;

    for await (const streamInfo of streamsList) {
      const subjects = streamInfo.config.subjects || [];
      if (subjects.some((s) => this.couldMatchStream(subject, s))) {
        targetStream = streamInfo.config.name;
        break;
      }
    }

    if (!targetStream) {
      return [];
    }

    // Get stream info
    const streamInfo = await this.jsm!.streams.info(targetStream);
    const lastSeq = streamInfo.state.last_seq;
    const firstSeq = streamInfo.state.first_seq;

    if (lastSeq === 0 || firstSeq === 0) {
      return [];
    }

    // Calculate sequence range - but we need to fetch ALL and filter :(
    // This is inefficient but works as fallback
    const maxFetch = Math.min(limit * 10, 500); // Fetch more to account for filtering
    const endSeq = lastSeq - offset;
    const startSeq = Math.max(firstSeq, endSeq - maxFetch + 1);

    console.log(`🔍 Legacy fetch: seq ${startSeq} to ${endSeq}`);

    // Fetch messages in parallel
    const fetchPromises = [];
    for (let seq = startSeq; seq <= endSeq && fetchPromises.length < maxFetch; seq++) {
      fetchPromises.push(
        this.jsm!.streams.getMessage(targetStream, { seq }).catch(() => null)
      );
    }

    const results = await Promise.all(fetchPromises);

    // Filter by subject
    for (const msg of results) {
      if (!msg) continue;

      if (!this.natsSubjectMatches(msg.subject, subject)) {
        continue;
      }

      const headers: { [key: string]: string[] } = {};
      if (msg.headers) {
        for (const [key, values] of msg.headers) {
          headers[key] = Array.isArray(values) ? values : [values];
        }
      }

      messages.push({
        seq: msg.seq,
        subject: msg.subject,
        data: Buffer.from(msg.data).toString("base64"),
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        time: msg.time,
      });

      if (messages.length >= limit) {
        break;
      }
    }

    messages.sort((a, b) => b.seq - a.seq);
    return messages;
  }

  // Helper methods to map NATS types to our enums
  private mapRetentionPolicy(retention: string): RetentionPolicy {
    switch (retention) {
      case "limits":
        return RetentionPolicy.Limits;
      case "interest":
        return RetentionPolicy.Interest;
      case "workqueue":
        return RetentionPolicy.WorkQueue;
      default:
        return RetentionPolicy.Limits;
    }
  }

  private mapStorageType(storage: string): StorageType {
    switch (storage) {
      case "file":
        return StorageType.File;
      case "memory":
        return StorageType.Memory;
      default:
        return StorageType.File;
    }
  }

  private mapAckPolicy(ackPolicy: string): AckPolicy {
    switch (ackPolicy) {
      case "none":
        return AckPolicy.None;
      case "all":
        return AckPolicy.All;
      case "explicit":
        return AckPolicy.Explicit;
      default:
        return AckPolicy.Explicit;
    }
  }

  // NATS-style subject matching (supports * and >)
  private natsSubjectMatches(subject: string, pattern: string): boolean {
    // Exact match
    if (subject === pattern) {
      return true;
    }

    // No wildcards = exact match required
    if (!pattern.includes("*") && !pattern.includes(">")) {
      return false;
    }

    // Convert NATS wildcards to regex
    // * matches exactly one token (non-empty)
    // > matches one or more tokens (can be multiple levels)
    const regexPattern = pattern
      .replace(/\./g, "\\.")  // Escape dots
      .replace(/\*/g, "[^.]+")  // * = one token
      .replace(/>/g, ".*");      // > = rest of subject

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(subject);
  }

  // Check if a user query pattern could match messages in a stream
  private couldMatchStream(queryPattern: string, streamSubject: string): boolean {
    // If stream subject is broader (has >), it could contain our pattern
    if (streamSubject.includes(">")) {
      const streamPrefix = streamSubject.replace(/>$/, "");
      return queryPattern.startsWith(streamPrefix) || streamSubject.startsWith(queryPattern.split(".")[0]);
    }

    // If stream subject has *, check if patterns are compatible
    if (streamSubject.includes("*")) {
      return this.natsSubjectMatches(queryPattern, streamSubject) ||
             this.natsSubjectMatches(streamSubject, queryPattern);
    }

    // Exact or partial match
    return streamSubject === queryPattern ||
           this.natsSubjectMatches(queryPattern, streamSubject);
  }

  async disconnect(): Promise<void> {
    console.log("🔌 Disconnecting from NATS...");
    if (this.nc) {
      await this.nc.close();
    }
    this.nc = null;
    this.jsm = null;
    this.js = null;
    this.connectionDetails = null;
    console.log("✅ Disconnected from NATS");
  }
}

// Export singleton instance
export const natsService = new NatsService();
