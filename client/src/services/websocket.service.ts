import * as protobuf from "protobufjs";

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
  private protoRoot: protobuf.Root | null = null;
  private protoLoaded: boolean = false;
  private protoLoading: Promise<void> | null = null;

  private constructor(private url: string = "ws://localhost:8080") {
    // Proto 정의 로드
    this.loadProtoDefinitions();
  }

  // 싱글톤 인스턴스 가져오기
  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  // Proto 정의 로드
  private async loadProtoDefinitions(): Promise<void> {
    if (this.protoLoaded || this.protoLoading) {
      return;
    }

    this.protoLoading = new Promise<void>((resolve, reject) => {
      try {
        protobuf
          .load("/proto/user.proto")
          .then((root) => {
            this.protoRoot = root;
            this.protoLoaded = true;
            console.log("Proto 정의가 로드되었습니다");
            resolve();
          })
          .catch((err) => {
            console.error("Proto 정의 로드 중 오류:", err);
            reject(err);
          });
      } catch (error) {
        console.error("Proto 로드 시도 중 오류:", error);
        reject(error);
      }
    });

    return this.protoLoading;
  }

  // WebSocket 연결
  public async connect(): Promise<void> {
    // Proto 정의 로드 시도
    try {
      await this.loadProtoDefinitions();
    } catch (error) {
      console.warn("Proto 정의 로드 실패, 계속 진행합니다:", error);
    }

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
      // 바이너리 타입 설정
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

  // Protocol Buffers 메시지 역직렬화 함수
  private deserializeMessage(buffer: Uint8Array, messageType: string): any {
    try {
      if (!this.protoRoot) {
        console.warn("Proto 정의가 로드되지 않았습니다. JSON으로 폴백합니다.");
        return JSON.parse(new TextDecoder().decode(buffer));
      }

      // 메시지 타입 조회
      const MessageType = this.protoRoot.lookupType("user." + messageType);
      if (!MessageType) {
        console.warn(
          `메시지 타입 ${messageType}을(를) 찾을 수 없습니다. JSON으로 폴백합니다.`
        );
        return JSON.parse(new TextDecoder().decode(buffer));
      }

      // Protobuf 디코딩
      const decodedMessage = MessageType.decode(buffer);
      // 자바스크립트 객체로 변환
      return MessageType.toObject(decodedMessage, {
        longs: String,
        enums: String,
        bytes: String,
      });
    } catch (error) {
      console.error(`메시지 역직렬화 중 오류(${messageType}):`, error);
      console.error("문제의 버퍼:", buffer);

      // 오류 시 JSON 폴백 시도
      try {
        return JSON.parse(new TextDecoder().decode(buffer));
      } catch (jsonError) {
        console.error("JSON 파싱 오류:", jsonError);
        throw new Error("메시지를 역직렬화할 수 없습니다.");
      }
    }
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
        if (data && data.users) {
          resolve(data.users as User[]);
        } else {
          console.warn("예상하지 못한 응답 형식:", data);
          resolve([]);
        }
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

      // ArrayBuffer 확인
      if (!(data instanceof ArrayBuffer)) {
        console.error("예상하지 못한 데이터 타입:", typeof data);
        return;
      }

      const buffer = new Uint8Array(data);

      // 버퍼가 비어있는지 확인
      if (buffer.length === 0) {
        console.warn("빈 메시지를 받았습니다.");
        return;
      }

      console.log("응답 타입:", buffer[0]);
      console.log("원시 바이너리 데이터:", buffer);
      console.log("바이너리 데이터 길이:", buffer.length);

      // 응답 타입 읽기
      const responseType = buffer[0];

      // 응답 데이터 파싱
      const responseData = buffer.slice(1);

      let parsedData: any;

      // 응답 타입에 따라 적절한 메시지 타입으로 역직렬화
      switch (responseType) {
        case 1: // User 응답
          parsedData = this.deserializeMessage(responseData, "User");
          break;
        case 2: // UserList 응답
          parsedData = this.deserializeMessage(responseData, "UserList");
          break;
        case 255: // 에러 응답
          // 에러는 JSON으로 처리
          const decodedData = new TextDecoder().decode(responseData);
          parsedData = JSON.parse(decodedData);
          console.error("서버 오류:", parsedData.error);
          break;
        default:
          console.warn(`알 수 없는 응답 타입: ${responseType}`);
          return;
      }

      console.log("파싱된 데이터:", parsedData);

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
