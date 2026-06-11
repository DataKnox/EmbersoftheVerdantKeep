// Jenkinsfile — Embers of the Verdant Keep
//
// Builds the Docker image for the static game site.
// Scope for now: BUILD ONLY. No tests, no registry push/delivery.
//
// Prerequisites on the Jenkins node:
//   - Docker Engine available to the agent (the `docker` CLI on PATH)
//   - Docker Pipeline plugin installed (provides the `docker.build` step)

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

        stage('Build Image') {
            steps {
                script {
                    // Build from the Dockerfile in the repo root.
                    // Tag with the build number for traceability...
                    def image = docker.build("${IMAGE_NAME}:${env.BUILD_NUMBER}")
                    // ...and move the rolling `latest` tag onto this build.
                    image.tag('latest')
                }
            }
        }
    }

    post {
        success {
            echo "Built ${IMAGE_NAME}:${env.BUILD_NUMBER} (also tagged ${IMAGE_NAME}:latest)"
        }
        failure {
            echo 'Image build failed — see the stage logs above.'
        }
    }
}
