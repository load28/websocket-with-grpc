// 데이터 크기 비교를 위한 순수 함수
export const calculateSavingsPercentage = (
  jsonSize: number,
  binarySize: number
): string => (((jsonSize - binarySize) / jsonSize) * 100).toFixed(2);

export const formatSizeComparison = (
  dataType: string,
  jsonSize: number,
  binarySize: number
): string => {
  const savingsPercentage = calculateSavingsPercentage(jsonSize, binarySize);
  return `데이터 크기 비교 - ${dataType}:\n- JSON: ${jsonSize} 바이트\n- Protocol Buffers: ${binarySize} 바이트\n- 절감율: ${savingsPercentage}%`;
};
