\# Reliable Webhook Processor



A reliable webhook processing system built with NestJS, PostgreSQL, and Next.js.



The system accepts webhook events, persists them before acknowledging the request, processes them asynchronously using multiple workers, prevents duplicate business processing, retries transient failures with backoff, and recovers events when a worker crashes.



\## Tech Stack



\- Backend: NestJS

\- Database: PostgreSQL

\- Frontend: Next.js

\- Queue: PostgreSQL-backed worker queue

\- ORM: TypeORM

\- Containerization: Docker Compose



\## Architecture



```text

&#x20;                   POST /webhooks

&#x20;                         |

&#x20;                         v

&#x20;                 +---------------+

&#x20;                 |    NestJS     |

&#x20;                 |    Backend    |

&#x20;                 +-------+-------+

&#x20;                         |

&#x20;                         v

&#x20;                 +---------------+

&#x20;                 |  PostgreSQL   |

&#x20;                 |               |

&#x20;                 | webhook\_events|

&#x20;                 | processing\_   |

&#x20;                 | attempts      |

&#x20;                 | processed\_    |

&#x20;                 | orders        |

&#x20;                 +-------+-------+

&#x20;                         |

&#x20;               +---------+---------+

&#x20;               |                   |

&#x20;               v                   v

&#x20;         +-----------+       +-----------+

&#x20;         |  Worker 1 |       |  Worker 2 |

&#x20;         +-----------+       +-----------+

&#x20;               |                   |

&#x20;               +---------+---------+

&#x20;                         |

&#x20;                         v

&#x20;                   Business action

&#x20;                   processed\_orders

&#x20;                         |

&#x20;                         v

&#x20;                  Next.js Operations

&#x20;                      Dashboard

