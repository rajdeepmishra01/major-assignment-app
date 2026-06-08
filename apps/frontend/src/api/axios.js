import axios from 'axios';

export const authApi = axios.create({
  baseURL: import.meta.env.VITE_AUTH_API_URL || 'http://localhost:5001',
});

export const todoApi = axios.create({
  baseURL: import.meta.env.VITE_TODO_API_URL || 'http://localhost:5002',
});

todoApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
