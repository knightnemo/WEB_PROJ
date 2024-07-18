package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.*
import Common.ServiceUtils.schemaName
import APIs.ClassroomAPI.Classroom
import io.circe.syntax.*

case class AllClassroomsQueryMessagePlanner(override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    readDBRows(
      s"SELECT * FROM ${schemaName}.classrooms",
      List()
    ).map { results =>
      if (results.isEmpty) "[]"
      else {
        val classrooms = results.map { row =>
          row.as[Classroom].getOrElse(throw new Exception("Failed to decode classroom"))
        }
        classrooms.asJson.noSpaces
      }
    }
  }