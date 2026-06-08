import { useEffect, useState } from 'react';
import { todoApi } from '../api/axios.js';

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  async function loadTodos() {
    const res = await todoApi.get('/api/todos');
    setTodos(res.data);
  }

  useEffect(() => {
    loadTodos().catch(err => setError(err.response?.data?.message || 'Failed to load todos'));
  }, []);

  async function addTodo(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await todoApi.post('/api/todos', { title });
    setTodos([res.data, ...todos]);
    setTitle('');
  }

  async function toggleTodo(todo) {
    const res = await todoApi.put(`/api/todos/${todo.id}`, { completed: !todo.completed });
    setTodos(todos.map(t => t.id === todo.id ? res.data : t));
  }

  async function deleteTodo(id) {
    await todoApi.delete(`/api/todos/${id}`);
    setTodos(todos.filter(t => t.id !== id));
  }

  return (
    <div className="card wide">
      <h1>Dashboard</h1>
      <p>Welcome, <b>{user.username}</b></p>
      <form onSubmit={addTodo} className="todo-form">
        <input placeholder="New todo" value={title} onChange={e => setTitle(e.target.value)} />
        <button type="submit">Add</button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul className="todos">
        {todos.map(todo => (
          <li key={todo.id}>
            <label>
              <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo)} />
              <span className={todo.completed ? 'done' : ''}>{todo.title}</span>
            </label>
            <button className="danger" onClick={() => deleteTodo(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
