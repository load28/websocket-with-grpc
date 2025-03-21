import React, { useEffect, useState } from "react";
import WebSocketClient from "../services/websocket.service";

interface DataSizeComparison {
  userCount: number;
  jsonSize: number;
  binarySize: number;
  savings: number;
  savingsPercent: string;
}

const DataComparison: React.FC = () => {
  const [comparisons, setComparisons] = useState<DataSizeComparison[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [restTiming, setRestTiming] = useState<number | null>(null);
  const [websocketTiming, setWebsocketTiming] = useState<number | null>(null);

  useEffect(() => {
    const loadComparisons = async () => {
      try {
        setLoading(true);
        const startTime = performance.now();
        const response = await fetch(
          "http://localhost:3001/api/data-comparison"
        );
        const data = await response.json();
        const endTime = performance.now();

        setRestTiming(endTime - startTime);
        setComparisons(data);
        setError(null);
      } catch (err) {
        console.error("데이터 비교 로드 실패:", err);
        setError("데이터 비교를 가져오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadComparisons();
  }, []);

  const loadWithWebSocket = async () => {
    try {
      if (WebSocketClient.getStatus() !== "open") {
        await WebSocketClient.connect();
      }

      const startTime = performance.now();

      await WebSocketClient.getAllUsers();

      const endTime = performance.now();
      setWebsocketTiming(endTime - startTime);
    } catch (err) {
      console.error("WebSocket 데이터 로드 실패:", err);
      setError("WebSocket 데이터 로드 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="data-comparison">
      <h2>REST API vs WebSocket 바이너리 통신 비교</h2>

      <div className="timing-comparison">
        <h3>성능 비교</h3>
        <button
          onClick={loadWithWebSocket}
          disabled={WebSocketClient.getStatus() !== "open"}
        >
          WebSocket 성능 테스트
        </button>

        {restTiming && (
          <p>
            REST API 응답 시간: <strong>{restTiming.toFixed(2)} ms</strong>
          </p>
        )}

        {websocketTiming && (
          <p>
            WebSocket 응답 시간:{" "}
            <strong>{websocketTiming.toFixed(2)} ms</strong>
          </p>
        )}

        {restTiming && websocketTiming && (
          <p>
            <strong>속도 향상: </strong>
            {restTiming > websocketTiming
              ? `${(
                  ((restTiming - websocketTiming) / restTiming) *
                  100
                ).toFixed(2)}% 더 빠름`
              : `${(
                  ((websocketTiming - restTiming) / websocketTiming) *
                  100
                ).toFixed(2)}% 더 느림`}
          </p>
        )}
      </div>

      <h3>크기 비교</h3>
      {loading && <p>데이터 로드 중...</p>}

      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <table className="comparison-table">
          <thead>
            <tr>
              <th>사용자 수</th>
              <th>JSON 크기 (바이트)</th>
              <th>Protobuf 크기 (바이트)</th>
              <th>절약된 바이트</th>
              <th>절감율 (%)</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((comp) => (
              <tr key={comp.userCount}>
                <td>{comp.userCount}</td>
                <td>{comp.jsonSize.toLocaleString()}</td>
                <td>{comp.binarySize.toLocaleString()}</td>
                <td>{comp.savings.toLocaleString()}</td>
                <td>{comp.savingsPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="explanation">
        <h3>왜 바이너리 통신이 더 효율적인가?</h3>
        <p>Protocol Buffers는 JSON보다 효율적인 데이터 인코딩을 제공합니다:</p>
        <ul>
          <li>필드 이름 대신 숫자 식별자 사용</li>
          <li>데이터 타입이 포함되어 있어 타입 정보 반복이 필요 없음</li>
          <li>숫자와 불리언 값을 효율적으로 인코딩</li>
          <li>텍스트 대신 이진 형식으로 표현</li>
        </ul>
        <p>
          또한 WebSocket 통신은 연결을 한 번 설정한 후 재사용하므로 각 요청마다
          새로운 HTTP 연결을 맺는 REST API보다 지속적인 통신에서 오버헤드가
          적습니다.
        </p>
      </div>
    </div>
  );
};

export default DataComparison;
