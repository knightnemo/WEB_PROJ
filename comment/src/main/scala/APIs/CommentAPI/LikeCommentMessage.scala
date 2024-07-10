package APIs.CommentAPI

import Common.API.API
import Global.ServiceCenter.commentServiceCode
import io.circe.Decoder
import io.circe.generic.semiauto._

case class LikeCommentMessage(id: String) extends CommentMessage[Boolean]

object LikeCommentMessage {
  implicit val likeCommentMessageDecoder: Decoder[LikeCommentMessage] = deriveDecoder[LikeCommentMessage]
}