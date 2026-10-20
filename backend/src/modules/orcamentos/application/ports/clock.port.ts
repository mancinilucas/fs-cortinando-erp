// Application clock port. Domain behavior receives explicit instants; this
// port is the single place where the Application reads the current time, so
// use cases stay deterministic in tests.

export abstract class Clock {
  abstract now(): Date;
}
