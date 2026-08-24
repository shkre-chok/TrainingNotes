---
name: Homework reminder schedules
description: Reminder schedule formats and compatibility behavior for homework programs
---

Hourly homework reminders use an `hourly:<hours>` schedule with an interval from 1 through 24 hours. Legacy `weekly:<day>:<HH:mm>` schedules remain readable and continue to use their stored IANA timezone.

**Why:** Hour-based reminders are needed for programs where a weekly calendar slot is too infrequent, but existing weekly programs must not stop sending reminders after the format changes.

**How to apply:** Hourly schedules are evaluated from elapsed time and do not require a timezone; weekly schedules still require a timezone. Keep both formats accepted when changing reminder validation or clients.