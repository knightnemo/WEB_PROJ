package APIs.CommentAPI

import Common.API.API
import Global.ServiceCenter.commentServiceCode
import io.circe.Decoder
import io.circe.generic.semiauto._

case class DislikeCommentMessage(id: String) extends CommentMessage[Boolean]

object DislikeCommentMessage {
  implicit val dislikeCommentMessageDecoder: Decoder[DislikeCommentMessage] = deriveDecoder[DislikeCommentMessage]
}