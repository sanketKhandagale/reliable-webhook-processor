'use client';

import { Fragment, useEffect, useState } from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000';

type Event = {
  id: string;
  eventId: string;
  type: string;
  data: any;
  status: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  leaseUntil: string | null;
  workerId: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type Attempt = {
  id: string;
  eventId: string;
  attemptNumber: number;
  workerId: string;
  startedAt: string;
  finishedAt: string | null;
  result: string;
  error: string | null;
};

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] =
    useState<string | null>(null);
  const [attempts, setAttempts] =
    useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] =
    useState<string | null>(null);

  const [eventId, setEventId] = useState('');
  const [type, setType] = useState('order.created');
  const [orderId, setOrderId] = useState('');
  const [simulation, setSimulation] = useState('ok');
  const [sending, setSending] = useState(false);

  async function loadEvents() {
    try {
      const response = await fetch(
        `${API_URL}/events`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(
          'Failed to load events',
        );
      }

      setEvents(await response.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadAttempts(
    eventId: string,
  ) {
    try {
      const response = await fetch(
        `${API_URL}/events/${eventId}/attempts`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(
          'Failed to load attempts',
        );
      }

      setAttempts(await response.json());
    } catch (error) {
      console.error(error);
    }
  }

  async function selectEvent(
    eventId: string,
  ) {
    if (selectedEvent === eventId) {
      setSelectedEvent(null);
      setAttempts([]);
      return;
    }

    setSelectedEvent(eventId);
    await loadAttempts(eventId);
  }

  async function retryEvent(
    eventId: string,
  ) {
    setRetrying(eventId);

    try {
      const response = await fetch(
        `${API_URL}/events/${eventId}/retry`,
        {
          method: 'POST',
        },
      );

      if (!response.ok) {
        throw new Error(
          'Retry failed',
        );
      }

      await loadEvents();
    } catch (error) {
      console.error(error);
      alert('Failed to retry event');
    } finally {
      setRetrying(null);
    }
  }

  async function sendWebhook() {
    if (!eventId.trim()) {
      alert('Event ID is required');
      return;
    }

    if (!orderId.trim()) {
      alert('Order ID is required');
      return;
    }

    setSending(true);

    try {
      const response = await fetch(
        `${API_URL}/webhooks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: eventId.trim(),
            type: type.trim() || 'order.created',
            data: {
              orderId: orderId.trim(),
              simulation,
            },
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ||
            'Failed to send webhook',
        );
      }

      setEventId('');
      setOrderId('');

      await loadEvents();

      alert(
        result.duplicate
          ? 'Duplicate webhook accepted safely.'
          : 'Webhook accepted.',
      );
    } catch (error) {
      console.error(error);
      alert('Failed to send webhook');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadEvents();

    const interval = setInterval(
      loadEvents,
      2000,
    );

    return () =>
      clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadAttempts(selectedEvent);
    }
  }, [events, selectedEvent]);

  return (
    <main
      style={{
        padding: '30px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1>Webhook Operations</h1>

      <p>
        Reliable Webhook Processor
      </p>

      <section
        style={{
          marginTop: '25px',
          padding: '20px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          background: '#fafafa',
        }}
      >
        <h2>Send Test Webhook</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(200px, 1fr))',
            gap: '12px',
            maxWidth: '700px',
          }}
        >
          <label>
            Event ID
            <input
              value={eventId}
              onChange={(e) =>
                setEventId(e.target.value)
              }
              placeholder="evt-001"
              style={inputStyle}
            />
          </label>

          <label>
            Type
            <input
              value={type}
              onChange={(e) =>
                setType(e.target.value)
              }
              placeholder="order.created"
              style={inputStyle}
            />
          </label>

          <label>
            Order ID
            <input
              value={orderId}
              onChange={(e) =>
                setOrderId(e.target.value)
              }
              placeholder="order-001"
              style={inputStyle}
            />
          </label>

          <label>
            Simulation
            <select
              value={simulation}
              onChange={(e) =>
                setSimulation(e.target.value)
              }
              style={inputStyle}
            >
              <option value="ok">
                ok
              </option>

              <option value="fail_then_succeed:2">
                fail_then_succeed:2
              </option>

              <option value="always_fail">
                always_fail
              </option>

              <option value="slow:20">
                slow:20
              </option>
            </select>
          </label>
        </div>

        <button
          onClick={sendWebhook}
          disabled={sending}
          style={{
            marginTop: '15px',
            padding: '10px 18px',
            cursor: sending
              ? 'not-allowed'
              : 'pointer',
          }}
        >
          {sending
            ? 'Sending...'
            : 'Send Webhook'}
        </button>
      </section>

      {loading ? (
        <p>Loading events...</p>
      ) : events.length === 0 ? (
        <p>No webhook events yet.</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '25px',
          }}
        >
          <thead>
            <tr>
              <th style={headerStyle}>
                Event ID
              </th>

              <th style={headerStyle}>
                Type
              </th>

              <th style={headerStyle}>
                Status
              </th>

              <th style={headerStyle}>
                Attempts
              </th>

              <th style={headerStyle}>
                Worker
              </th>

              <th style={headerStyle}>
                Error
              </th>

              <th style={headerStyle}>
                Created
              </th>

              <th style={headerStyle}>
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {events.map((event) => (
              <Fragment key={event.id}>
                <tr>
                  <td style={cellStyle}>
                    <button
                      onClick={() =>
                        selectEvent(
                          event.eventId,
                        )
                      }
                      style={{
                        border: 'none',
                        background:
                          'transparent',
                        cursor: 'pointer',
                        textDecoration:
                          'underline',
                      }}
                    >
                      {event.eventId}
                    </button>
                  </td>

                  <td style={cellStyle}>
                    {event.type}
                  </td>

                  <td style={cellStyle}>
                    <strong>
                      {event.status}
                    </strong>
                  </td>

                  <td style={cellStyle}>
                    {event.attemptCount}
                  </td>

                  <td style={cellStyle}>
                    {event.workerId || '-'}
                  </td>

                  <td style={cellStyle}>
                    {event.lastError || '-'}
                  </td>

                  <td style={cellStyle}>
                    {new Date(
                      event.createdAt,
                    ).toLocaleString()}
                  </td>

                  <td style={cellStyle}>
                    {event.status ===
                      'failed' && (
                      <button
                        onClick={() =>
                          retryEvent(
                            event.eventId,
                          )
                        }
                        disabled={
                          retrying ===
                          event.eventId
                        }
                      >
                        {retrying ===
                        event.eventId
                          ? 'Retrying...'
                          : 'Retry'}
                      </button>
                    )}
                  </td>
                </tr>

                {selectedEvent ===
                  event.eventId && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: '20px',
                        background:
                          '#f5f5f5',
                      }}
                    >
                      <h3>
                        Attempt History
                      </h3>

                      {attempts.length ===
                      0 ? (
                        <p>
                          No attempts yet.
                        </p>
                      ) : (
                        <table
                          style={{
                            width: '100%',
                            borderCollapse:
                              'collapse',
                          }}
                        >
                          <thead>
                            <tr>
                              <th
                                style={
                                  headerStyle
                                }
                              >
                                Attempt
                              </th>

                              <th
                                style={
                                  headerStyle
                                }
                              >
                                Worker
                              </th>

                              <th
                                style={
                                  headerStyle
                                }
                              >
                                Started
                              </th>

                              <th
                                style={
                                  headerStyle
                                }
                              >
                                Finished
                              </th>

                              <th
                                style={
                                  headerStyle
                                }
                              >
                                Result
                              </th>

                              <th
                                style={
                                  headerStyle
                                }
                              >
                                Error
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {attempts.map(
                              (attempt) => (
                                <tr
                                  key={
                                    attempt.id
                                  }
                                >
                                  <td
                                    style={
                                      cellStyle
                                    }
                                  >
                                    {
                                      attempt.attemptNumber
                                    }
                                  </td>

                                  <td
                                    style={
                                      cellStyle
                                    }
                                  >
                                    {
                                      attempt.workerId
                                    }
                                  </td>

                                  <td
                                    style={
                                      cellStyle
                                    }
                                  >
                                    {new Date(
                                      attempt.startedAt,
                                    ).toLocaleString()}
                                  </td>

                                  <td
                                    style={
                                      cellStyle
                                    }
                                  >
                                    {attempt.finishedAt
                                      ? new Date(
                                          attempt.finishedAt,
                                        ).toLocaleString()
                                      : '-'}
                                  </td>

                                  <td
                                    style={
                                      cellStyle
                                    }
                                  >
                                    {
                                      attempt.result
                                    }
                                  </td>

                                  <td
                                    style={
                                      cellStyle
                                    }
                                  >
                                    {
                                      attempt.error ||
                                      '-'
                                    }
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const headerStyle = {
  border: '1px solid #ccc',
  padding: '10px',
  textAlign: 'left' as const,
  background: '#f2f2f2',
};

const cellStyle = {
  border: '1px solid #ccc',
  padding: '10px',
};

const inputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box' as const,
  marginTop: '5px',
  padding: '9px',
};