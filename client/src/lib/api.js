async function request(path, { method = 'GET', body, hostToken } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (hostToken) headers['x-host-token'] = hostToken;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Check your connection.'), { status: 0 });
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { status: res.status });
  }
  return data;
}

export const api = {
  getHealth: () => request('/health'),
  createSession: (title) => request('/sessions', { method: 'POST', body: { title } }),
  getSession: (code) => request(`/sessions/${code}`),
  endSession: (code, hostToken) => request(`/sessions/${code}/end`, { method: 'POST', hostToken }),
  getSummary: (code, hostToken) => request(`/sessions/${code}/summary`, { hostToken }),
};
