// 사용자 도메인 모델 정의
export interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  role: string;
}

export interface UserList {
  users: readonly User[];
}

export interface UserRequest {
  readonly id: string;
}

export interface Empty {}
