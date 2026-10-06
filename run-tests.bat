@echo off
echo ========================================================
echo Running VokaLog M1 Verification Suite
echo ========================================================

echo [1/3] Building Cloud Functions TypeScript...
call npm --prefix functions install
call npm --prefix functions run build
if %ERRORLEVEL% NEQ 0 (
  echo [FAIL] Functions build failed!
  exit /b %ERRORLEVEL%
)
echo [PASS] Functions build succeeded!

echo [2/3] Running Cloud Functions Unit Tests (Vitest)...
call npm --prefix functions test
if %ERRORLEVEL% NEQ 0 (
  echo [FAIL] Functions unit tests failed!
  exit /b %ERRORLEVEL%
)
echo [PASS] Functions unit tests passed!

echo [3/3] Running Firestore Security Rules Unit Tests...
call npm --prefix rules-tests install
call npm --prefix rules-tests test
if %ERRORLEVEL% NEQ 0 (
  echo [FAIL] Rules tests failed!
  exit /b %ERRORLEVEL%
)
echo [PASS] Rules tests passed!

echo ========================================================
echo All M1 checks passed successfully!
echo ========================================================
