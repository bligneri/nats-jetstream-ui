import { defineEventHandler, getQuery, createError, setResponseHeaders } from 'h3';
import { natsService } from '../utils/natsService';

export default defineEventHandler(async (event) => {
  const { subject, limit, beforeSeq, stream, expectedCount } = getQuery(event);

  if (!subject || typeof subject !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Subject query parameter is required',
    });
  }

  const limitNum = limit ? parseInt(limit as string, 10) : 50;
  const beforeSeqNum = beforeSeq ? parseInt(beforeSeq as string, 10) : undefined;
  const streamName = stream && typeof stream === 'string' ? stream : undefined;
  const expectedCountNum = expectedCount ? parseInt(expectedCount as string, 10) : undefined;

  // Set headers for Server-Sent Events
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable buffering for nginx/proxies
  });

  try {
    console.log(`📬 API Stream: Starting stream for subject="${subject}", stream="${streamName || 'auto'}", limit=${limitNum}, beforeSeq=${beforeSeqNum || 'none'}, expectedCount=${expectedCountNum || 'unknown'}`);

    let sent = 0;
    let lowestSeq = beforeSeqNum;
    let hasMore = true;
    let consecutiveEmptyWindows = 0;
    const MAX_EMPTY_WINDOWS = 10; // Stop after 10 consecutive empty windows (100k messages)

    // If we know the expected count, use it as the effective limit (but don't exceed requested limit)
    const effectiveLimit = expectedCountNum ? Math.min(expectedCountNum, limitNum) : limitNum;
    console.log(`📬 API Stream: Effective limit set to ${effectiveLimit} (expectedCount: ${expectedCountNum || 'N/A'}, requestedLimit: ${limitNum})`);

    // Keep fetching windows until we have enough messages or reach the beginning
    while (sent < effectiveLimit && hasMore) {
      // Check if client has disconnected
      if (event.node.req.destroyed || event.node.res.destroyed) {
        console.log('🛑 API Stream: Client disconnected, stopping search');
        break;
      }

      console.log(`📬 API Stream: Fetching window (sent so far: ${sent}/${limitNum}, beforeSeq: ${lowestSeq || 'none'})`);

      // Send heartbeat to keep connection alive during long searches
      event.node.res.write(`: searching window before seq ${lowestSeq || 'latest'}\n\n`);
      if (event.node.res.flush) {
        event.node.res.flush();
      }

      // Get messages from this window
      const messageStream = natsService.getMessagesStream(subject, effectiveLimit - sent, lowestSeq, streamName);

      let foundInWindow = 0;
      let windowLowestSeq = lowestSeq;

      // Calculate the search window range (must match natsService calculation)
      const MAX_SEARCH_RANGE = 10000;
      const searchWindowEnd = lowestSeq ? lowestSeq - 1 : undefined;
      const searchWindowStart = searchWindowEnd ? Math.max(1, searchWindowEnd - MAX_SEARCH_RANGE + 1) : undefined;

      // Set up a heartbeat interval to keep connection alive during chunk processing
      const heartbeatInterval = setInterval(() => {
        event.node.res.write(`: heartbeat\n\n`);
        if (event.node.res.flush) {
          event.node.res.flush();
        }
      }, 2000); // Send heartbeat every 2 seconds

      let reachedLimit = false;
      try {
        for await (const message of messageStream) {
          // Check if client has disconnected
          if (event.node.req.destroyed || event.node.res.destroyed) {
            console.log('🛑 API Stream: Client disconnected during message iteration, stopping');
            hasMore = false; // Exit outer loop too
            break;
          }

          // Send message
          sent++;
          foundInWindow++;
          event.node.res.write(`data: ${JSON.stringify(message)}\n\n`);

          // Flush immediately to ensure streaming (prevent buffering)
          if (event.node.res.flush) {
            event.node.res.flush();
          }

          // Track lowest sequence in this window
          if (!windowLowestSeq || message.seq < windowLowestSeq) {
            windowLowestSeq = message.seq;
          }

          // Stop if we've reached the effective limit
          if (sent >= effectiveLimit) {
            console.log(`📬 API Stream: Reached effective limit of ${effectiveLimit} messages`);
            reachedLimit = true;
            break;
          }
        }
      } finally {
        // Always clear the heartbeat interval
        clearInterval(heartbeatInterval);
      }

      console.log(`📬 API Stream: Found ${foundInWindow} messages in this window (total: ${sent}/${limitNum}, searched: ${searchWindowStart}-${searchWindowEnd})`);

      // Update lowest sequence for next iteration
      if (foundInWindow > 0) {
        // Move to next window from the lowest message we found
        lowestSeq = windowLowestSeq;
        consecutiveEmptyWindows = 0; // Reset empty window counter

        // If we reached the limit, stop searching more windows
        if (reachedLimit) {
          hasMore = lowestSeq ? lowestSeq > 1 : false;
          console.log(`📬 API Stream: Reached limit mid-window, hasMore=${hasMore} (lowestSeq=${lowestSeq})`);
          break;
        }
      } else {
        // Empty window - move to the start of the window we just searched
        // We searched [searchWindowStart, searchWindowEnd], so next window should start before searchWindowStart
        if (searchWindowStart) {
          lowestSeq = searchWindowStart;
          console.log(`📬 API Stream: Empty window, moving to next window before seq ${lowestSeq}`);
        }
        consecutiveEmptyWindows++;
        console.log(`📬 API Stream: Empty window ${consecutiveEmptyWindows}/${MAX_EMPTY_WINDOWS}`);
      }

      // Check if we should stop
      if (sent >= limitNum) {
        // We reached the limit, assume there are more unless we're at seq 1
        hasMore = lowestSeq ? lowestSeq > 1 : false;
        console.log(`📬 API Stream: Reached limit, hasMore=${hasMore} (lowestSeq=${lowestSeq})`);
        break;
      } else if (consecutiveEmptyWindows >= MAX_EMPTY_WINDOWS) {
        // Too many consecutive empty windows, likely reached the end
        console.log(`📬 API Stream: ${MAX_EMPTY_WINDOWS} consecutive empty windows, stopping`);
        hasMore = false;
        break;
      } else if (!lowestSeq || lowestSeq <= 1) {
        // Reached sequence 1 or no messages at all
        console.log(`📬 API Stream: Reached beginning of stream (seq ${lowestSeq || 'none'})`);
        hasMore = false;
        break;
      } else {
        // Continue to next window
        console.log(`📬 API Stream: Need more messages (${sent}/${limitNum}), continuing to next window before seq ${lowestSeq}`);
      }
    }

    // Send completion event with the continuation point
    event.node.res.write(`data: {"type":"complete","hasMore":${hasMore},"continueFromSeq":${lowestSeq || null}}\n\n`);
    console.log(`📬 API Stream: Completed streaming ${sent} messages (hasMore: ${hasMore}, continueFromSeq: ${lowestSeq}) for subject="${subject}"`);

    event.node.res.end();
  } catch (error: any) {
    console.error(`📬 API Stream Error for "${subject}":`, error.message);
    event.node.res.write(`data: {"type":"error","message":"${error.message || 'Failed to fetch messages'}"}\n\n`);
    event.node.res.end();
  }
});
