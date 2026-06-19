import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

// Vendors
export const getVendors = (params) => api.get('/vendors', { params });
export const getTrades = () => api.get('/vendors/trades');
export const createVendor = (data) => api.post('/vendors', data);
export const updateVendor = (id, data) => api.put(`/vendors/${id}`, data);
export const deleteVendor = (id) => api.delete(`/vendors/${id}`);

// Projects
export const getProjects = () => api.get('/projects');
export const createProject = (data) => api.post('/projects', data);
export const updateProject = (id, data) => api.put(`/projects/${id}`, data);
export const deleteProject = (id) => api.delete(`/projects/${id}`);

// Plans
export const getPlans = (project_id) => api.get('/plans', { params: { project_id } });
export const uploadPlans = (formData) =>
  api.post('/plans/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deletePlan = (id) => api.delete(`/plans/${id}`);
export const downloadPlanUrl = (id) => `/api/plans/${id}/download`;

// Distributions
export const sendDistribution = (data) => api.post('/distributions/send', data);

// Tracker
export const getTracker = (params) => api.get('/tracker', { params });
export const updateTracker = (distribution_id, data) => api.put(`/tracker/${distribution_id}`, data);
export const exportTrackerUrl = () => `/api/tracker/export`;

export default api;
