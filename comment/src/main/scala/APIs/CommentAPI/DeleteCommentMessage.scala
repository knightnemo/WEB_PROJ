package APIs.CommentAPI

import Common.API.API
import Global.ServiceCenter.commentServiceCode
import io.circe.Decoder
import io.circe.generic.semiauto._

case class DeleteCommentMessage(id: String) extends CommentMessage[Boolean]

object DeleteCommentMessage {
  implicit val deleteCommentMessageDecoder: Decoder[DeleteCommentMessage] = deriveDecoder[DeleteCommentMessage]
}
