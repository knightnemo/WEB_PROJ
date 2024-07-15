package Common.API

import io.circe.Encoder
import io.circe.syntax.*

trait MessageSerializer[T] {
  def toMessage(t: T): String
}

given AutoSerializer[T](using encoder: Encoder[T]): MessageSerializer[T] with
  def toMessage(t: T): String = t.asJson.noSpaces

