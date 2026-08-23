export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly title: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
