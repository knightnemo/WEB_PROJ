package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{readDBRows, *}
import Common.ServiceUtils.schemaName
import cats.effect.IO
import io.circe.generic.auto.*
import io.circe.{HCursor, Json}

case class AllUsersQueryMessagePlanner(override val planContext: PlanContext) extends Planner[List[String]]:
  override def plan(using PlanContext): IO[List[String]] = {
    println(s"Executing query: SELECT user_name FROM ${schemaName}.user_name")
    readDBRows(
      s"SELECT user_name FROM ${schemaName}.user_name",
      List()
    ).map { jsonList =>
      println(s"Received JSON list: $jsonList")
      val userNames = jsonList.flatMap { json =>
        val cursor: HCursor = json.hcursor
        cursor.get[String]("userName").toOption.orElse {
          cursor.get[String]("user_name").toOption
        }.orElse {
          println(s"Failed to parse username from JSON: $json")
          None
        }
      }
      println(s"Extracted user names: $userNames")
      if (userNames.isEmpty) {
        println("Warning: No user names were extracted from the database")
      } else {
        println(s"Successfully extracted ${userNames.length} user names")
      }
      userNames
    }
  }