# 항공권 추천글 Meta 자동 게시 연결

Threads 원글의 공개 추천 조건을 통과한 항공권만 Facebook 페이지와 Instagram 전문 계정에 보냅니다. 개인 푸시 알림 전부가 게시되는 것은 아닙니다. Threads 원글이 게시되면 대기열에 기록되고 5분 간격 게시기가 채널별로 처리합니다. Instagram은 가격 카드 JPEG와 캡션, Facebook은 추천 문구와 항공권 링크를 게시합니다. 기존 Threads 블로그 답글 승인은 그대로 별도입니다.

Netlify 운영 사이트 환경변수에 아래를 등록하고 다시 배포합니다. 토큰을 저장소나 채팅에 붙여넣지 않습니다.

| 변수 | 값 |
| --- | --- |
| `FACEBOOK_PAGE_ID` | 게시할 Facebook 페이지 ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | 그 페이지의 게시 권한이 있는 Page access token |
| `INSTAGRAM_USER_ID` | 연결된 Instagram 전문 계정의 숫자 ID |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram 콘텐츠 게시 권한이 있는 Meta access token |
| `SOCIAL_CROSSPOST_ENABLED` | 실제 게시 준비가 끝났을 때만 `true` |

Facebook Page access token에는 `pages_manage_posts` 등 필요한 페이지 권한이 있어야 합니다. Instagram 계정은 Meta API 게시가 가능한 전문 계정이어야 하고, 앱에는 해당 계정의 콘텐츠 게시 권한이 있어야 합니다. Instagram과 Facebook이 같은 Meta 앱에 연결되더라도 계정 ID와 토큰은 각각 확인합니다.

처음 연결한 뒤 작은 범위의 항공권 추천 1건을 점검합니다. 토큰 누락 시 게시기는 대기하고, 게시 API가 오류를 돌려주면 그 채널 항목을 `needs_review`로 남겨 중복 게시를 막습니다. 게시 시도가 불확실하게 끝난 항목은 자동 재시도하지 않습니다. Instagram 캡션의 URL은 앱에서 클릭 가능한 링크로 표시되지 않을 수 있습니다.
