import React from 'react';
import './App.css';
import UserList from './components/UserList';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>사용자 정보 시스템</h1>
        <p>WebSocket과 gRPC를 이용한 바이너리 통신 예제</p>
      </header>
      
      <main>
        <UserList />
      </main>
      
      <footer>
        <p>React + WebSocket + gRPC 프로젝트</p>
      </footer>
    </div>
  );
}

export default App;
