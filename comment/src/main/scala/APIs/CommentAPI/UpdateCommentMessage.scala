package APIs.CommentAPI

import Common.API.API
import Global.ServiceCenter.commentServiceCode
import io.circe.Decoder
import io.circe.generic.semiauto._

case class UpdateCommentMessage(id: String, content: String) extends CommentMessage[Boolean]

object UpdateCommentMessage {
  implicit val updateCommentMessageDecoder: Decoder[UpdateCommentMessage] = deriveDecoder[UpdateCommentMessage]
}
