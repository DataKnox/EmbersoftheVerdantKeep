// Jenkinsfile — Embers of the Verdant Keep
//
// Pipeline stages:
//   1. Checkout
//   2. Secret Scan        — gitleaks scans working tree for committed secrets
//   3. Syntax Check       — node --check on every JS module
//   4. Pre-Build Tests    — smoke, unit, and manifest tests run in parallel
//   5. Headless Browser   — Playwright loads the game in Chromium, checks for
//                           errors and confirms the canvas paints
//   6. Build Image        — docker build, tagged :BUILD_NUMBER and :latest
//   7. Image Security Scan — Trivy checks the built image for HIGH/CRITICAL CVEs
//
// Prerequisites on the Jenkins node:
//   - Docker Engine + Docker CLI on PATH
//   - Docker Pipeline plugin
//   - Node.js on PATH (for stages 3 & 4)
//   - Python 3 on PATH (for the http.server in stage 5)

pipeline {
    agent any

    environment {
        IMAGE_NAME = 'knoxtrades/embers'
        REPO_URL   = 'https://github.com/DataKnox/EmbersoftheVerdantKeep.git'
    }

    stages {

        stage('Checkout') {
            steps {
                git url: "${REPO_URL}", branch: 'main'
            }
        }

        // ── Secret scan ────────────────────────────────────────────────────────
        // Runs before any other work so a leaked key fails fast.
        // Scans the working tree (files on disk); add --no-git to skip history.
        stage('Secret Scan') {
            steps {
                sh '''
                    docker run --rm \
                        -v "$(pwd):/repo:ro" \
                        zricethezav/gitleaks:latest \
                        detect --source /repo --no-git
                '''
            }
        }

        // ── Syntax check ───────────────────────────────────────────────────────
        stage('Syntax Check') {
            steps {
                sh 'sh tests/syntax-check.sh'
            }
        }

        // ── Pre-build tests (parallel) ─────────────────────────────────────────
        stage('Pre-Build Tests') {
            parallel {

                stage('Smoke Tests') {
                    steps {
                        // Loads every JS module via Node vm stubs; fails if any
                        // IIFE throws during initialisation.
                        sh 'node tests/smoke.js'
                    }
                }

                stage('Unit Tests') {
                    steps {
                        // Pure-logic tests: tile queries, AABB collision sweep.
                        sh 'node tests/unit.js'
                    }
                }

                stage('Manifest Check') {
                    steps {
                        // Verifies every PNG listed in assets/manifest.json
                        // exists on disk.
                        sh 'node tests/manifest-check.js'
                    }
                }

            }
        }

        // ── Headless browser test ─────────────────────────────────────────────
        // Runs inside the official Playwright Docker image (has Chromium
        // pre-installed). A python3 http.server serves the game so that
        // assets/manifest.json loads correctly via fetch().
        stage('Headless Browser Test') {
            agent {
                docker {
                    image 'mcr.microsoft.com/playwright:v1.44.0-jammy'
                    reuseNode true
                    args  '-u root'
                }
            }
            steps {
                sh '''
                    cd tests && npm install && cd ..
                    python3 -m http.server 8080 &
                    SERVER_PID=$!
                    # Give the server a moment to start.
                    sleep 2
                    node tests/headless.js
                    RESULT=$?
                    kill "$SERVER_PID" 2>/dev/null || true
                    exit $RESULT
                '''
            }
        }

        // ── Docker image build ────────────────────────────────────────────────
        stage('Build Image') {
            steps {
                script {
                    def image = docker.build("${IMAGE_NAME}:${env.BUILD_NUMBER}")
                    image.tag('latest')
                }
            }
        }

        // ── CVE scan on the built image ───────────────────────────────────────
        // Mounts the Docker socket so Trivy can pull the local image.
        // Fails the build on any HIGH or CRITICAL vulnerability.
        stage('Image Security Scan') {
            steps {
                sh '''
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v "$HOME/.trivy/cache:/root/.cache/trivy" \
                        aquasec/trivy:latest \
                        image --exit-code 1 --severity HIGH,CRITICAL \
                        "${IMAGE_NAME}:${BUILD_NUMBER}"
                '''
            }
        }

    }

    post {
        // Publish XML reports regardless of outcome so failures are visible
        // in the Tests tab, not just in the console log.
        always {
            junit allowEmptyResults: true, testResults: 'tests/results/*.xml'
        }
        success {
            echo "Pipeline passed — ${IMAGE_NAME}:${env.BUILD_NUMBER} is clean and ready."
        }
        failure {
            echo 'Pipeline failed — see the stage logs above.'
        }
    }
}
