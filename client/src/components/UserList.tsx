import React, { useEffect, useState } from "react";
import WebSocketClient, {
  User,
  WebSocketStatus,
} from "../services/websocket.service";

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WebSocketStatus>(
    WebSocketStatus.CLOSED
  );

  useEffect(() => {
    const unsubscribe = WebSocketClient.addStatusListener(setConnectionStatus);

    const connectWebSocket = async () => {
      try {
        await WebSocketClient.connect();
        await loadUsers();
      } catch (err) {
        console.error("WebSocket 연결 실패:", err);
        setError("서버에 연결할 수 없습니다. 나중에 다시 시도해주세요.");
        setLoading(false);
      }
    };

    connectWebSocket();

    // 컴포넌트가 언마운트되면 리스너 및 연결 정리
    return () => {
      unsubscribe();
      WebSocketClient.disconnect();
    };
  }, []);

  // 사용자 데이터 로드
  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const userList = await WebSocketClient.getAllUsers();
      setUsers(userList);
    } catch (err) {
      console.error("사용자 데이터 로드 실패:", err);
      setError("사용자 데이터를 가져오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 특정 사용자 가져오기
  const handleGetUser = async (id: string) => {
    try {
      const user = await WebSocketClient.getUserById(id);
      // 단일 사용자 정보 조회 시, 해당 사용자만 표시
      setUsers([user]);
    } catch (err) {
      console.error("사용자 조회 실패:", err);
      setError("해당 사용자를 조회하는데 실패했습니다.");
    }
  };

  // 모든 사용자 다시 가져오기
  const handleRefreshUsers = () => {
    loadUsers();
  };

  return (
    <div className="user-list">
      <div className="controls">
        <div className="status">
          <span>연결 상태: </span>
          <span className={`status-${connectionStatus}`}>
            {connectionStatus === WebSocketStatus.OPEN
              ? "연결됨"
              : connectionStatus === WebSocketStatus.CONNECTING
              ? "연결 중..."
              : connectionStatus === WebSocketStatus.CLOSING
              ? "연결 종료 중..."
              : "연결 끊김"}
          </span>
        </div>

        <div className="actions">
          <button
            onClick={handleRefreshUsers}
            disabled={connectionStatus !== WebSocketStatus.OPEN}
          >
            사용자 목록 새로고침
          </button>
        </div>

        <div className="user-search">
          <input
            type="text"
            placeholder="사용자 ID로 검색"
            id="user-id-input"
          />
          <button
            onClick={() => {
              const input = document.getElementById(
                "user-id-input"
              ) as HTMLInputElement;
              if (input.value) {
                handleGetUser(input.value);
              }
            }}
            disabled={connectionStatus !== WebSocketStatus.OPEN}
          >
            사용자 조회
          </button>
        </div>
      </div>

      {loading && <div className="loading">로딩 중...</div>}

      {error && <div className="error">{error}</div>}

      {!loading && !error && users.length === 0 && (
        <div className="empty">사용자 정보가 없습니다.</div>
      )}

      {!loading && !error && users.length > 0 && (
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>이름</th>
              <th>이메일</th>
              <th>나이</th>
              <th>역할</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.age}</td>
                <td>{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserList;
