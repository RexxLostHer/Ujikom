import { db, messaging, FieldValue } from './admin';

export interface NotificationPayload {
  type: 'application' | 'attendance' | 'logbook' | 'sos' | 'assessment' | 'job';
  title: string;
  body: string;
  relatedPath?: string;
}

/**
 * Creates an in-app notification in users/{uid}/notifications and dispatches optional FCM push.
 */
export async function createNotification(
  uid: string,
  payload: NotificationPayload
): Promise<string> {
  const notifRef = db.collection('users').doc(uid).collection('notifications').doc();
  
  await notifRef.set({
    id: notifRef.id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    read: false,
    relatedPath: payload.relatedPath || null,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Attempt non-blocking FCM push notification if user has registered FCM token
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const fcmToken = userDoc.data()?.fcmToken;
    if (fcmToken) {
      await messaging.send({
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: payload.type,
          relatedPath: payload.relatedPath || '',
        },
      });
    }
  } catch (error) {
    console.warn(`[notify] Optional FCM push dispatch skipped for user ${uid}:`, error);
  }

  return notifRef.id;
}
