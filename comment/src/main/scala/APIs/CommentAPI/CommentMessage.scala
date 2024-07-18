package APIs.CommentAPI

import Common.API.API
import Global.ServiceCenter.commentServiceCode
import io.circe.Decoder

abstract class CommentMessage[ReturnType: Decoder] extends API[ReturnType](commentServiceCode)