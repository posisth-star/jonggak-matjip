// 종각역 중심점과 검색 반경, 음식 종류 정의
export const CENTER = { lat: 37.5702, lng: 126.9831 };
export const RADIUS_M = 1600;

const food = (key, label) => ({ key, label, query: label, groupCode: 'FD6', match: label });

export const CATEGORIES = [
  food('korean', '한식'),
  food('chinese', '중식'),
  food('japanese', '일식'),
  food('western', '양식'),
  food('snack', '분식'),
  food('asian', '아시아음식'),
  { key: 'cafe', label: '카페', query: '카페', groupCode: 'CE7', match: null },
];
