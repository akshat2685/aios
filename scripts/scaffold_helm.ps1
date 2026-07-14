$helmDir = "C:\Users\ijain\AIOS\k8s\aios-helm"
New-Item -ItemType Directory -Force -Path "$helmDir\templates"

@"
apiVersion: v2
name: aios
description: A Helm chart for AIOS Enterprise Platform
type: application
version: 1.0.0
appVersion: "1.0.0"
"@ | Out-File -FilePath "$helmDir\Chart.yaml" -Encoding utf8

@"
global:
  namespace: aios-system
  imagePullPolicy: IfNotPresent
  storageClass: "standard"

modelGateway:
  replicaCount: 3
  image: aios/model-gateway:v1.0.0
  resources:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "1Gi"
  hpa:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80

vectorDb:
  replicaCount: 3
  image: aios/vector-db:v1.0.0
  persistence:
    enabled: true
    size: 50Gi
  resources:
    requests:
      cpu: "1"
      memory: "2Gi"
    limits:
      cpu: "2"
      memory: "4Gi"

eventBus:
  replicaCount: 3
  image: aios/event-bus:v1.0.0
  persistence:
    enabled: true
    size: 20Gi

memoryService:
  replicaCount: 2
  image: aios/memory-service:v1.0.0

agentPods:
  replicaCount: 5
  image: aios/agent-pods:v1.0.0

ingress:
  enabled: true
  className: "nginx"
  host: "api.aios.enterprise.local"
"@ | Out-File -FilePath "$helmDir\values.yaml" -Encoding utf8

@"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-model-gateway
  labels:
    app: model-gateway
spec:
  replicas: {{ .Values.modelGateway.replicaCount }}
  selector:
    matchLabels:
      app: model-gateway
  template:
    metadata:
      labels:
        app: model-gateway
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
        - name: model-gateway
          image: "{{ .Values.modelGateway.image }}"
          imagePullPolicy: {{ .Values.global.imagePullPolicy }}
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
          resources:
            {{- toYaml .Values.modelGateway.resources | nindent 12 }}
"@ | Out-File -FilePath "$helmDir\templates\model-gateway.yaml" -Encoding utf8

@"
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: {{ .Release.Name }}-vector-db
  labels:
    app: vector-db
spec:
  serviceName: "{{ .Release.Name }}-vector-db-hl"
  replicas: {{ .Values.vectorDb.replicaCount }}
  selector:
    matchLabels:
      app: vector-db
  template:
    metadata:
      labels:
        app: vector-db
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
      containers:
        - name: vector-db
          image: "{{ .Values.vectorDb.image }}"
          ports:
            - containerPort: 6333
          volumeMounts:
            - name: data
              mountPath: /var/lib/vector-db
          resources:
            {{- toYaml .Values.vectorDb.resources | nindent 12 }}
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: {{ .Values.global.storageClass }}
      resources:
        requests:
          storage: {{ .Values.vectorDb.persistence.size }}
"@ | Out-File -FilePath "$helmDir\templates\vector-db.yaml" -Encoding utf8

@"
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ .Release.Name }}-model-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ .Release.Name }}-model-gateway
  minReplicas: {{ .Values.modelGateway.hpa.minReplicas }}
  maxReplicas: {{ .Values.modelGateway.hpa.maxReplicas }}
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: {{ .Values.modelGateway.hpa.targetCPUUtilizationPercentage }}
"@ | Out-File -FilePath "$helmDir\templates\hpa.yaml" -Encoding utf8

@"
apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}-model-gateway
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
      name: http
  selector:
    app: model-gateway
"@ | Out-File -FilePath "$helmDir\templates\service.yaml" -Encoding utf8

@"
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ .Release.Name }}-model-gateway-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: model-gateway
"@ | Out-File -FilePath "$helmDir\templates\pdb.yaml" -Encoding utf8

Write-Host "Helm chart generated successfully at $helmDir"
