import axios from 'axios';

export const authApi = axios.create({
  baseURL: '/api/auth',
});

export const todoApi = axios.create({
  baseURL: '/api/todos',
});

todoApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});