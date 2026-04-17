import { useTestStore } from '../stores/test';
import { authedFetch } from '../api/authedFetch';

/**
 * Background sync service for offline-first test mode.
 * Queues failed answer submissions and retries when network is available.
 */

const SYNC_CHECK_INTERVAL = 5000; // Check every 5 seconds

let syncIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start background sync service
 */
export function startOfflineSyncService() {
  if (syncIntervalId) return; // Already running

  console.log('[OfflineSync] Starting background sync service');

  syncIntervalId = setInterval(async () => {
    const state = useTestStore.getState();

    // Only sync if network is available and we have pending answers
    if (!state.networkAvailable || state.pendingAnswers.length === 0) {
      return;
    }

    console.log('[OfflineSync] Syncing', state.pendingAnswers.length, 'pending answers');

    // Batch sync all pending answers
    const pendingAnswers = [...state.pendingAnswers];
    const attemptId = state.attemptId;

    if (!attemptId) return;

    for (const answer of pendingAnswers) {
      try {
        const response = await authedFetch(`/api/tests/attempt/${attemptId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section: answer.section,
            question_index: answer.questionIndex,
            answer_data: answer.answerData,
          }),
        });

        if (response.ok) {
          console.log('[OfflineSync] Synced:', answer.section, 'Q', answer.questionIndex);
          useTestStore.getState().clearPendingAnswer(answer.section, answer.questionIndex);
        } else {
          console.error('[OfflineSync] Sync failed:', response.status);
          // Increment retry count but don't remove
          if (answer.retries < answer.maxRetries) {
            answer.retries++;
          }
        }
      } catch (err) {
        console.error('[OfflineSync] Sync error:', err);
        if (answer.retries < answer.maxRetries) {
          answer.retries++;
        }
      }
    }
  }, SYNC_CHECK_INTERVAL);
}

/**
 * Stop background sync service
 */
export function stopOfflineSyncService() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[OfflineSync] Stopped background sync service');
  }
}

/**
 * Force immediate sync of all pending answers
 */
export async function syncPendingAnswers(attemptId: number) {
  const state = useTestStore.getState();
  const pendingAnswers = [...state.pendingAnswers];

  console.log('[OfflineSync] Force syncing', pendingAnswers.length, 'answers');

  let successCount = 0;

  for (const answer of pendingAnswers) {
    try {
      const response = await authedFetch(`/api/tests/attempt/${attemptId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: answer.section,
          question_index: answer.questionIndex,
          answer_data: answer.answerData,
        }),
      });

      if (response.ok) {
        successCount++;
        useTestStore.getState().clearPendingAnswer(answer.section, answer.questionIndex);
      }
    } catch (err) {
      console.error('[OfflineSync] Force sync error:', err);
    }
  }

  console.log('[OfflineSync] Force sync complete:', successCount, '/', pendingAnswers.length, 'succeeded');
  return successCount === pendingAnswers.length;
}
