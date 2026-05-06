# Git 브랜치 작업 가이드

이 문서는 Git 브랜치를 사용해 안전하게 협업하는 방법을 설명합니다.

초보자는 Git이 어렵게 느껴질 수 있지만, 이번 프로젝트에서는 정해진 순서만 지키면 됩니다.

---

## 1. 브랜치를 사용하는 이유

여러 명이 같은 프로젝트를 작업할 때 모두가 `main` 브랜치에서 직접 작업하면 코드가 쉽게 꼬일 수 있습니다.

그래서 각자 자기 작업용 브랜치를 만들어 작업합니다.

```text
main
- 항상 실행 가능한 최종 코드만 둔다.
- 직접 작업하지 않는다.

feature/작업이름
- 각자 기능을 작업하는 브랜치다.
- 작업이 끝나면 Pull Request를 만든다.
```

---

## 2. 이 프로젝트의 브랜치 이름

하영 님은 다음 브랜치를 사용합니다.

```text
feature/crawler-menu-ingestion
```

작업이 추가되면 `feature/기능이름` 형식으로 새 브랜치를 만들면 됩니다.

---

## 3. 작업 시작 순서

작업을 시작할 때는 항상 아래 명령어 순서를 사용합니다.

```bash
git switch main
git pull origin main
git switch -c feature/crawler-menu-ingestion
```

각 명령어의 의미는 다음과 같습니다.

```text
git switch main
- main 브랜치로 이동한다.

git pull origin main
- GitHub에 올라간 최신 main 코드를 가져온다.

git switch -c feature/...
- 내 작업용 브랜치를 새로 만든다.
```

main에서 최신 코드를 받은 뒤 브랜치를 만들어야, 다른 팀원이 작업한 최신 내용과 충돌할 가능성이 줄어듭니다.

이미 같은 이름의 브랜치를 만들어둔 상태라면 `-c` 없이 이동합니다.

```bash
git switch feature/crawler-menu-ingestion
```

---

## 4. 작업 중 상태 확인

작업 중간에 내가 어떤 파일을 수정했는지 확인하려면 다음 명령어를 사용합니다.

```bash
git status
```

이 명령어는 현재 수정된 파일 목록을 보여줍니다.

커밋하기 전에 꼭 한 번 확인하는 습관을 들입니다.

---

## 5. 커밋하기

작업이 어느 정도 완료되면 커밋합니다.

```bash
git add .
git commit -m "feat: add cafeteria menu crawler"
```

각 명령어의 의미는 다음과 같습니다.

```text
git add .
- 수정한 파일들을 커밋 대상으로 올린다.

git commit -m "메시지"
- 현재 작업 내용을 하나의 저장 지점으로 만든다.
```

---

## 6. 커밋 메시지 규칙

커밋 메시지는 너무 어렵게 생각하지 않아도 됩니다.

아래 형식을 사용합니다.

```text
feat: 새 기능 추가
fix: 오류 수정
docs: 문서 수정
refactor: 코드 구조 정리
```

예시는 다음과 같습니다.

```text
feat: add cafeteria menu crawler
fix: fix crawler date parsing
docs: update crawler guide
```

---

## 7. GitHub에 올리기

커밋한 내용을 GitHub에 올립니다.

```bash
git push origin feature/crawler-menu-ingestion
```

---

## 8. Pull Request 만들기

GitHub에 브랜치를 올린 뒤 Pull Request를 만듭니다.

PR은 “내가 작업한 코드를 main에 합쳐도 되는지 확인해달라”는 요청입니다.

작업한 내용을 간단히 정리하고, 팀원 A에게 리뷰를 요청합니다.

크롤러 작업을 했다면 수집된 JSON 예시를 함께 올리면 좋습니다.

---

## 9. 충돌이 났을 때

Git 충돌이 나면 혼자 해결하려고 하지 말고 팀원 A에게 공유합니다.

공유할 내용은 다음과 같습니다.

```text
- 어떤 브랜치에서 작업 중인지
- 어떤 명령어를 실행했는지
- 터미널에 나온 메시지
- 충돌난 파일 이름
```

충돌은 잘못한 것이 아닙니다. 여러 명이 같은 파일을 수정하면 자연스럽게 생길 수 있습니다.

다만 초보자가 혼자 해결하다가 코드가 망가질 수 있으므로, 충돌이 나면 바로 공유합니다.

---

## 10. 작업할 때 꼭 지킬 것

```text
- main 브랜치에서 직접 작업하지 않는다.
- 작업 시작 전에 main을 최신 상태로 만든다.
- 기능 단위로 브랜치를 만든다.
- 작업 후 실행 결과를 확인한다.
- PR을 올린 뒤 팀원 A에게 확인을 요청한다.
```
