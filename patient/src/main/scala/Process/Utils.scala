package Process

import Global.ServerConfig
import cats.effect.{IO, Resource}
import io.circe.generic.auto.*
import io.circe.parser.decode

import scala.io.{BufferedSource, Source}

object Utils {
  /** 读取config文件 */
  def readConfig(filePath: String): IO[ServerConfig] = {
    // Define a resource for managing the file
    val fileResource: Resource[IO, BufferedSource] = Resource.make {
      IO(Source.fromFile(filePath)) // Acquire the resource
    } { source =>
      IO(source.close()).handleErrorWith(_ => IO.unit) // Release the resource, ignoring errors on close
    }

    // Use the resource
    fileResource.use { source =>
      IO {
        val fileContents = source.getLines().mkString
        decode[ServerConfig](fileContents) match {
          case Right(config) => config
          case Left(error) => throw new RuntimeException(s"Failed to decode config: $error")
        }
      }
    }
  }
}

