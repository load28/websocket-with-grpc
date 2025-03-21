// 사용자 타입 정의
export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: string;
}

// WebSocket 상태 타입
export enum WebSocketStatus {
  CONNECTING = "connecting",
  OPEN = "open",
  CLOSING = "closing",
  CLOSED = "closed",
}

// WebSocket 클라이언트 클래스
export class WebSocketClient {
  private socket: WebSocket | null = null;
  private static instance: WebSocketClient | null = null;
  private messageCallbacks: Map<number, (data: any) => void> = new Map();
  private statusListeners: ((status: WebSocketStatus) => void)[] = [];

  private constructor(private url: string = "ws://localhost:8080") {}

  // 싱글톤 인스턴스 가져오기
  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  // WebSocket 연결
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (
        this.socket &&
        (this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING)
      ) {
        this.notifyStatusChange(WebSocketStatus.OPEN);
        resolve();
        return;
      }

      this.socket = new WebSocket(this.url);
      this.socket.binaryType = "arraybuffer";
      this.notifyStatusChange(WebSocketStatus.CONNECTING);

      this.socket.onopen = () => {
        console.log("WebSocket 연결이 열렸습니다");
        this.notifyStatusChange(WebSocketStatus.OPEN);
        resolve();
      };

      this.socket.onclose = () => {
        console.log("WebSocket 연결이 닫혔습니다");
        this.notifyStatusChange(WebSocketStatus.CLOSED);
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket 오류:", error);
        reject(error);
      };

      this.socket.onmessage = this.handleMessage.bind(this);
    });
  }

  // 연결 종료
  public disconnect(): void {
    if (this.socket) {
      this.notifyStatusChange(WebSocketStatus.CLOSING);
      this.socket.close();
      this.socket = null;
    }
  }

  // 상태 변경 알림
  private notifyStatusChange(status: WebSocketStatus): void {
    this.statusListeners.forEach((listener) => listener(status));
  }

  // 상태 리스너 추가
  public addStatusListener(
    listener: (status: WebSocketStatus) => void
  ): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  // 특정 사용자 조회
  public getUserById(userId: string): Promise<User> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket이 연결되어 있지 않습니다"));
        return;
      }

      // 바이너리 요청 데이터 생성 (타입 1 = GetUser)
      const requestType = new Uint8Array([1]);
      const userIdBytes = new TextEncoder().encode(userId);
      const requestData = new Uint8Array(
        requestType.length + userIdBytes.length
      );
      requestData.set(requestType);
      requestData.set(userIdBytes, requestType.length);

      // 콜백 등록
      this.messageCallbacks.set(1, (data) => {
        resolve(data as User);
      });

      // 요청 전송
      this.socket.send(requestData);
    });
  }

  // 모든 사용자 조회
  public getAllUsers(): Promise<User[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket이 연결되어 있지 않습니다"));
        return;
      }

      // 바이너리 요청 데이터 생성 (타입 2 = ListUsers)
      const requestData = new Uint8Array([2]);

      // 콜백 등록
      this.messageCallbacks.set(2, (data) => {
        resolve(data.users as User[]);
      });

      // 요청 전송
      this.socket.send(requestData);
    });
  }

  // 메시지 핸들러
  private handleMessage(event: MessageEvent): void {
    try {
      // 바이너리 응답 처리
      const data = event.data;
      const buffer = new Uint8Array(data);

      // 응답 타입 읽기
      const responseType = buffer[0];

      // 응답 데이터 파싱
      const responseData = buffer.slice(1);
      const decodedData = new TextDecoder().decode(responseData);
      const parsedData = JSON.parse(decodedData);

      // 등록된 콜백 호출
      const callback = this.messageCallbacks.get(responseType);
      if (callback) {
        callback(parsedData);
        // 일회성 콜백 제거
        this.messageCallbacks.delete(responseType);
      } else {
        console.warn(`응답 타입 ${responseType}에 대한 콜백이 없습니다`);
      }
    } catch (error) {
      console.error("메시지 처리 중 오류 발생:", error);
    }
  }
}

// 간편한 사용을 위한 기본 내보내기
export default WebSocketClient.getInstance();
