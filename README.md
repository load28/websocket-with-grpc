# React, WebSocket, gRPC 기반 사용자 정보 시스템

이 프로젝트는 React 클라이언트와 통합된 WebSocket 및 gRPC 서버를 사용하여 바이너리 형식의 사용자 정보를 주고받는 시스템입니다. 모든 코드는 TypeScript로 작성되었습니다.

## 프로젝트 구조

```
grpc-websocket-project/
├── proto/
│   └── user.proto       # 사용자 정보를 위한 Protocol Buffers 정의
│
├── server/
│   ├── src/
│   │   └── index.ts     # gRPC 및 WebSocket 통합 서버
│   ├── package.json
│   └── tsconfig.json
│
└── client/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── services/
    │   │   └── websocket.service.ts  # WebSocket 클라이언트 서비스
    │   ├── components/
    │   │   └── UserList.tsx          # 사용자 목록 컴포넌트
    │   ├── App.tsx
    │   ├── App.css
    │   ├── index.tsx
    │   └── index.css
    ├── package.json
    └── tsconfig.json
```

## 주요 기능

1. **서버**:
   - gRPC 서비스: 사용자 정보 조회 및 목록 조회
   - WebSocket 서버: 클라이언트와 바이너리 통신
   - 통합된 서비스: WebSocket 메시지를 gRPC 요청으로 변환

2. **클라이언트**:
   - React 기반 사용자 인터페이스
   - WebSocket을 통한 바이너리 통신
   - 사용자 정보 요청 및 표시

## 바이너리 통신 프로토콜

클라이언트와 서버 간 통신은 다음과 같은 바이너리 형식을 사용합니다:

1. **요청 형식**:
   - 첫 번째 바이트: 요청 타입 (1: 특정 사용자 조회, 2: 전체 사용자 목록 조회)
   - 나머지 바이트: 요청 데이터 (예: GetUser 요청의 경우 사용자 ID)

2. **응답 형식**:
   - 첫 번째 바이트: 응답 타입 (1: 사용자 정보, 2: 사용자 목록, 255: 오류)
   - 나머지 바이트: Protocol Buffers로 직렬화된 응답 데이터

## 설치 및 실행

### 서버 설정

```bash
cd server
npm install
npm run build
npm start
```

### 클라이언트 설정

```bash
cd client
npm install
npm start
```

## 사용 방법

1. 서버와 클라이언트를 모두 실행합니다.
2. 클라이언트는 자동으로 WebSocket을 통해 서버에 연결됩니다.
3. "사용자 목록 새로고침" 버튼을 클릭하여 모든 사용자를 조회합니다.
4. 특정 사용자 ID를 입력하고 "사용자 조회" 버튼을 클릭하여 개별 사용자를 조회합니다.

## 기술 스택

- **서버**: Node.js, TypeScript, gRPC, WebSocket, Protocol Buffers
- **클라이언트**: React, TypeScript, WebSocket API, Protocol Buffers
- **통신**: 바이너리 데이터 형식, Protocol Buffers
