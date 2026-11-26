// 출발지(알파빌딩, 서울 종로구 종로 34)와 도보 20분 반경, 음식 종류 정의
export const ORIGIN_NAME = '알파빌딩';
export const ORIGIN_ADDRESS = '서울 종로구 종로 34';
export const CENTER = { lat: 37.5698358, lng: 126.9811326 }; // 카카오 장소 검색 '알파빌딩' 좌표
export const WALK_LIMIT_MIN = 20;
// 도보 시간 = 직선거리 × 1.3 ÷ 80m/분 → 20분 = 약 1,230m
export const RADIUS_M = 1230;

const food = (key, label) => ({ key, label, query: label, groupCode: 'FD6', match: label });

export const CATEGORIES = [
  // 전체: 음식점(FD6) 전체를 카카오 추천순으로. 키워드가 필수라 '맛집'을 쓰고, 종류 필터는 하지 않는다.
  { key: 'all', label: '전체', query: '맛집', groupCode: 'FD6', match: null, exclude: ['패스트푸드', '간식', '식품판매'] },
  food('korean', '한식'),
  food('chinese', '중식'),
  food('japanese', '일식'),
  food('western', '양식'),
  food('snack', '분식'),
  food('asian', '아시아음식'),
];
