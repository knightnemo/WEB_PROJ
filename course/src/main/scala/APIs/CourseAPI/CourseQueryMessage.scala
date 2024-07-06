package APIs.CourseAPI

import io.circe.Decoder

case class CourseQueryMessage(courseId: String) extends CourseMessage[Option[Course]]

object CourseQueryMessage {
  // This import brings the Course.courseDecoder into scope
  import Course._

  // Decoder for Option[Course] is automatically derived by circe
  implicit val optionCourseDecoder: Decoder[Option[Course]] = Decoder.decodeOption[Course]
}