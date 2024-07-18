package APIs.CourseAPI

import Common.API.PlanContext
import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

case class CourseChange(
                         courseId: String,
                         courseTitle: String,  // 新增字段
                         changeType: String
                       )

object CourseChange {
  implicit val decoder: Decoder[CourseChange] = deriveDecoder[CourseChange]
  implicit val encoder: Encoder[CourseChange] = deriveEncoder[CourseChange]
}

case class RecordCourseChangeMessage(courseId: String, changeType: String, planContext: PlanContext) extends CourseMessage[String]
case class GetUserCourseChangesMessage(userName: String, planContext: PlanContext) extends CourseMessage[String]

object CourseChangesMessages {
  implicit val recordCourseChangeMessageDecoder: Decoder[RecordCourseChangeMessage] = deriveDecoder
  implicit val recordCourseChangeMessageEncoder: Encoder[RecordCourseChangeMessage] = deriveEncoder

  implicit val getUserCourseChangesMessageDecoder: Decoder[GetUserCourseChangesMessage] = deriveDecoder
  implicit val getUserCourseChangesMessageEncoder: Encoder[GetUserCourseChangesMessage] = deriveEncoder
}