import { defineEventHandler, getQuery, createError, setResponseHeaders } from 'h3';
import { natsService } from '../utils/natsService';

export default defineEventHandler(async (event) => {
  const { subject, limit, beforeSeq, stream } = getQuery(event);

  if (!subject || typeof subject !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Subject query parameter is required',
    });
  }

  const limitNum = limit ? parseInt(limit as string, 10) : 50;
  const beforeSeqNum = beforeSeq ? parseInt(beforeSeq as string, 10) : undefined;
  const streamName = stream && typeof stream === 'string' ? stream : undefined;

  // Set headers for Server-Sent Events
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable buffering for nginx/proxies
  });

  try {
    console.log(`📬 API Stream: Starting stream for subject="${subject}", stream="${streamName || 'auto'}", limit=${limitNum}, beforeSeq=${beforeSeqNum || 'none'}`);

    let sent = 0;
    let lowestSeq = beforeSeqNum;
    let hasMore = true;
    let consecutiveEmptyWindows = 0;
    const MAX_EMPTY_WINDOWS = 10; // Stop after 10 consecutive empty windows (100k messages)

    // Keep fetching windows until we have enough messages or reach the beginning
    while (sent < limitNum && hasMore) {
      console.log(`📬 API Stream: Fetching window (sent so far: ${sent}/${limitNum}, beforeSeq: ${lowestSeq || 'none'})`);

      // Send heartbeat to keep connection alive during long searches
      event.node.res.write(`: searching window before seq ${lowestSeq || 'latest'}\n\n`);
      if (event.node.res.flush) {
        event.node.res.flush();
      }

      // Get messages from this window
      const messageStream = natsService.getMessagesStream(subject, limitNum - sent, lowestSeq, streamName);

      let foundInWindow = 0;
      let windowLowestSeq = lowestSeq;
      let windowStartSeq: number | undefined = undefined;

      for await (const message of messageStream) {
        // Send message
        sent++;
        foundInWindow++;
        event.node.res.write(`data: ${JSON.stringify(message)}\n\n`);

        // Flush immediately to ensure streaming (prevent buffering)
        if (event.node.res.flush) {
          event.node.res.flush();
        }

        // Track lowest and highest sequence in this window to know the search boundaries
        if (!windowLowestSeq || message.seq < windowLowestSeq) {
          windowLowestSeq = message.seq;
        }
        if (!windowStartSeq || message.seq < windowStartSeq) {
          windowStartSeq = message.seq;
        }

        // Stop if we've reached the limit
        if (sent >= limitNum) {
          console.log(`📬 API Stream: Reached limit of ${limitNum} messages`);
          break;
        }
      }

      console.log(`📬 API Stream: Found ${foundInWindow} messages in this window (total: ${sent}/${limitNum}, windowStart: ${windowStartSeq})`);

      // Update lowest sequence for next iteration
      if (foundInWindow > 0) {
        // Move to next window from the lowest message we found
        lowestSeq = windowLowestSeq;
        consecutiveEmptyWindows = 0; // Reset empty window counter
      } else {
        // Empty window - we need to move to the NEXT window backward
        // The current window searched [windowStart, beforeSeq-1]
        // Next window should be [windowStart-10000, windowStart-1]
        if (lowestSeq) {
          // Move back by MAX_SEARCH_RANGE (10k) to search the next window
          const MAX_SEARCH_RANGE = 10000;
          lowestSeq = Math.max(1, lowestSeq - MAX_SEARCH_RANGE);
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

    // Send completion event
    event.node.res.write(`data: {"type":"complete","hasMore":${hasMore}}\n\n`);
    console.log(`📬 API Stream: Completed streaming ${sent} messages (hasMore: ${hasMore}) for subject="${subject}"`);

    event.node.res.end();
  } catch (error: any) {
    console.error(`📬 API Stream Error for "${subject}":`, error.message);
    event.node.res.write(`data: {"type":"error","message":"${error.message || 'Failed to fetch messages'}"}\n\n`);
    event.node.res.end();
  }
});
