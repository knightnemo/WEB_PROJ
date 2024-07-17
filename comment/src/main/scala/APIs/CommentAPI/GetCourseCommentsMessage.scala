package APIs.CommentAPI

import io.circe.Decoder
import io.circe.generic.semiauto._

case class GetCourseCommentsMessage(
                                     courseId: String,
                                     page: Int,
                                     pageSize: Int
                                   ) extends CommentMessage[List[CommentInfo]]:
  require(courseId.nonEmpty, "courseId must not be empty")
  require(page > 0, "page must be greater than 0")
  require(pageSize > 0 && pageSize <= 100, "pageSize must be between 1 and 100")

object GetCourseCommentsMessage {
  implicit val decoder: Decoder[GetCourseCommentsMessage] = deriveDecoder[GetCourseCommentsMessage]
}