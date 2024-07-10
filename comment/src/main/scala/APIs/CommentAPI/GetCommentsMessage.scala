package APIs.CommentAPI

import Common.API.API
import Global.ServiceCenter.commentServiceCode
import io.circe.Decoder
import io.circe.generic.semiauto._

case class GetCommentsMessage(courseId: String) extends CommentMessage[List[Comment]]

object GetCommentsMessage {
  implicit val getCommentsMessageDecoder: Decoder[GetCommentsMessage] = deriveDecoder[GetCommentsMessage]
}
