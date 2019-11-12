pipeline {
  agent any
  stages {
    stage('Build') {
      agent {
        docker {
          image 'node:10'
        }

      }
      steps {
        sh 'npm install'
        echo 'Build completed?'
      }
    }

  }
}