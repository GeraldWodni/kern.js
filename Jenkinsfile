podTemplate(yaml: '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: buildah
    image: quay.io/buildah/stable:v1.29.0
    command:
    - sleep
    args:
    - 99d
    securityContext:
      privileged: true
    env:
      - name: REG_USERNAME
        valueFrom:
          secretKeyRef:
            name: jenkins-registry-login
            key: username
      - name: REG_PASSWORD
        valueFrom:
          secretKeyRef:
            name: jenkins-registry-login
            key: password
      - name: REG_HOSTNAME
        valueFrom:
          secretKeyRef:
            name: jenkins-registry-login
            key: hostname
      - name: REG_FOLDER
        valueFrom:
          secretKeyRef:
            name: jenkins-registry-login
            key: folder
''') {
    node(POD_LABEL) {
        stage("checkout") {
            checkout scm
            script {
                VERSION_NUMBER = VersionNumber(versionNumberString: '${BUILD_YEAR}${BUILDS_THIS_YEAR, XXX}')
                currentBuild.displayName = "${VERSION_NUMBER}"
                env.BUILD_NUMBER=VERSION_NUMBER
            }
        }
        stage("dockerlogin") {
            container('buildah') {
                sh 'echo "${REG_PASSWORD}" | buildah login -u ${REG_USERNAME} --password-stdin ${REG_HOSTNAME}'
            }
        }
        stage("dockerfile") {
            container('buildah') {
                sh 'buildah version && \
                buildah build \
                --build-arg REG_HOSTNAME=${REG_HOSTNAME} \
                --build-arg REG_FOLDER=${REG_FOLDER} \
                --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js:b${BUILD_NUMBER} \
                -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js:latest .'
            }
        }
        stage("dockerfile big") {
            container('buildah') {
                sh 'buildah version && \
                buildah build -f docker/big/Dockerfile \
                --build-arg REG_HOSTNAME=${REG_HOSTNAME} \
                --build-arg REG_FOLDER=${REG_FOLDER} \
                --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-big:b${BUILD_NUMBER} \
                -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-big:latest .'
            }
        }
        stage("dockerfile website-sync") {
            container('buildah') {
                dir('docker/website-sync') {
                    sh 'buildah version && \
                    buildah build \
                    --build-arg REG_HOSTNAME=${REG_HOSTNAME} \
                    --build-arg REG_FOLDER=${REG_FOLDER} \
                    --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                    -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-website-sync:b${BUILD_NUMBER} \
                    -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-website-sync:latest .'
                }
            }
        }
        stage("dockerfile database-sync") {
            container('buildah') {
                dir('docker/database-sync') {
                    sh 'buildah version && \
                    buildah build \
                    --build-arg REG_HOSTNAME=${REG_HOSTNAME} \
                    --build-arg REG_FOLDER=${REG_FOLDER} \
                    --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                    -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-database-sync:b${BUILD_NUMBER} \
                    -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-database-sync:latest .'
                }
            }
        }
        stage("dockerpush") {
            container('buildah') {
                sh 'buildah push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js:b${BUILD_NUMBER}'
                sh 'buildah push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js:latest'
                // push big
                sh 'buildah push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-big:b${BUILD_NUMBER}'
                sh 'buildah push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-big:latest'
                // push website-sync
                sh 'buildah push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-website-sync:b${BUILD_NUMBER}'
                sh 'buildah push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-website-sync:latest'
                // push database-sync
                sh 'buildah push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-database-sync:b${BUILD_NUMBER}'
                sh 'buildah push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js-database-sync:latest'
            }
        }
    }
}
