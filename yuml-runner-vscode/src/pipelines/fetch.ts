export interface FetchRequest extends RequestInit {
  url: string
}

export interface FetchResponse {
  response: Response
}

export async function get(request: FetchRequest) {
  const response: FetchResponse = {
    response: await fetch(request.url, request),
  }
  return response
}

export async function responseOk({ response }: FetchResponse) {
  return response.status == 200
}

export interface FetchDownloadBuffer {
  buffer: Buffer
}

export async function download({ response }: FetchResponse) {
  const buffer: FetchDownloadBuffer = {
    buffer: Buffer.from(await response.arrayBuffer()),
  }
  return buffer
}