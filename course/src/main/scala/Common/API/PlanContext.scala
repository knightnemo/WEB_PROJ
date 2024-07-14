package Common.API

import io.circe.*
import io.circe.generic.semiauto.*

case class PlanContext(traceID: TraceID, transactionLevel: Int)

object PlanContext {
  implicit val encodePlanContext: Encoder[PlanContext] = deriveEncoder[PlanContext]
  implicit val decodePlanContext: Decoder[PlanContext] = deriveDecoder[PlanContext]
}