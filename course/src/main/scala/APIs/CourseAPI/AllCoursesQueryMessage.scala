package APIs.CourseAPI

import Common.API.API
import Global.ServiceCenter.courseServiceCode
import io.circe.Decoder

case class AllCoursesQueryMessage() extends CourseMessage[List[Course]]

object AllCoursesQueryMessage {
  implicit val decoder: Decoder[AllCoursesQueryMessage] = Decoder.const(AllCoursesQueryMessage())
}