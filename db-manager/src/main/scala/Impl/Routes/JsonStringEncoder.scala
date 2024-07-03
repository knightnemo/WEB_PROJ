package Impl.Routes

import io.circe.{Encoder, Json}
import io.circe.syntax.*


trait JsonStringEncoder[T] {
  def toJsonString(value: T): String
}

object JsonStringEncoder {
  // For strings, just return the string itself
  implicit val stringEncoder: JsonStringEncoder[String] = (value: String) => value

  // For other types that can be encoded as JSON using Circe
  implicit def circeJsonEncoder[T](implicit encoder: Encoder[T]): JsonStringEncoder[T] = (value: T) => value.asJson.noSpaces
}

