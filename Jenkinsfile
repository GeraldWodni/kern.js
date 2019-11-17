podTemplate(yaml: '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: docker
    image: docker:stable
    command:
    - sleep
    args:
    - 99d
    env:
      - name: DOCKER_HOST
        value: tcp://localhost:2375
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
  - name: docker-daemon
    image: docker:stable-dind
    securityContext:
      privileged: true
    env:
      - name: DOCKER_TLS_CERTDIR
        value: ""
''') {
    node(POD_LABEL) {
        stage("checkout") {
            checkout scm
        }
        stage("dockerfile") {
            container('docker') {
                sh 'docker version && DOCKER_BUILDKIT=1 docker build --progress plain -t ${REG_HOSTNAME}/${REG_FOLDER}/kern.js:b${BUILD_NUMBER} .'
            }
        }
        stage("dockerlogin") {
            container('docker') {
                sh 'echo "${REG_PASSWORD}" | docker login -u ${REG_USERNAME} --password-stdin ${REG_HOSTNAME}'
            }
        }
        stage("dockerpush") {
            container('docker') {
                sh 'docker push ${REG_HOSTNAME}/${REG_FOLDER}/kern.js:b${BUILD_NUMBER}'
            }
        }
        stage("trigger-down") {
            build job: '../teamwork/master', wait: false
        }
    }
}
