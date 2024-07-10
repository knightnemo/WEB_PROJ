package APIs.CommentAPI

import Common.API.API
import Global.ServiceCenter.commentServiceCode
import io.circe.Decoder
import io.circe.generic.semiauto._

case class AddCommentMessage(
                              courseId: String,
                              userId: String,
                              content: String,
                              likes: String = "0",
                              dislikes: String = "0",
                              parentId: Option[String] = None
                            ) extends CommentMessage[Comment]

object AddCommentMessage {
  implicit val addCommentMessageDecoder: Decoder[AddCommentMessage] = deriveDecoder[AddCommentMessage]
}