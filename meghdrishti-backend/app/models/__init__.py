"""Import all model modules so Base.metadata is fully populated for Alembic."""
from app.models.alerts import Alert  # noqa: F401
from app.models.anomalies import Anomaly, AnomalyEvidence  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
from app.models.calibration import CalibrationProfile  # noqa: F401
from app.models.health import StationHealth  # noqa: F401
from app.models.ingestion import IngestionJob, RawObservation, ReplayJob  # noqa: F401
from app.models.ml import ModelMetric, ModelVersion  # noqa: F401
from app.models.observations import ObservationFeatures, WeatherObservation  # noqa: F401
from app.models.qc import ContextResult, MLResult, QCRuleResult  # noqa: F401
from app.models.reviews import OperatorLabel, OperatorReview  # noqa: F401
from app.models.stations import DataSource, Station, StationNeighbor, StationSensor  # noqa: F401
from app.models.users import Role, User, UserRole  # noqa: F401
